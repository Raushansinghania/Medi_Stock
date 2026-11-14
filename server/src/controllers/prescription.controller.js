const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { query } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/prescriptions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file type. Only PDF, JPG, PNG, and WebP files are accepted.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter,
});

/**
 * Get all prescriptions (Customer sees own, Staff sees all)
 * @route GET /api/v1/prescriptions
 */
const getAllPrescriptions = async (req, res, next) => {
  try {
    const { status, customer_id } = req.query;
    let sql = `
      SELECT p.*, c.customer_name, c.phone AS customer_phone, u.name AS uploaded_by_user,
             v.name AS verified_by_name
      FROM prescriptions p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN users v ON p.verified_by = v.id
    `;
    const conditions = [];
    const params = [];

    // Customer can only view their own
    if (req.user?.role === 'customer') {
      conditions.push('(p.user_id = ? OR c.email = ?)');
      params.push(req.user.id, req.user.email);
    } else if (customer_id) {
      conditions.push('p.customer_id = ?');
      params.push(customer_id);
    }

    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY p.id DESC';

    const [rows] = await query(sql, params);
    return ApiResponse.success(res, rows, 'Prescriptions retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get prescription details by ID
 * @route GET /api/v1/prescriptions/:id
 */
const getPrescriptionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await query(
      `SELECT p.*, c.customer_name, c.phone AS customer_phone, c.email, u.name AS user_name,
              v.name AS verified_by_name
       FROM prescriptions p
       LEFT JOIN customers c ON p.customer_id = c.id
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN users v ON p.verified_by = v.id
       WHERE p.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw ApiError.notFound('Prescription not found');
    }

    const prescription = rows[0];

    // Customer security check
    if (req.user?.role === 'customer') {
      if (prescription.user_id !== req.user.id && prescription.email !== req.user.email) {
        throw ApiError.forbidden('You do not have access to view this prescription');
      }
    }

    return ApiResponse.success(res, prescription, 'Prescription retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Upload prescription with file
 * @route POST /api/v1/prescriptions/upload
 */
const uploadPrescription = async (req, res, next) => {
  try {
    const { doctor_name, prescription_date, notes } = req.body;
    const file = req.file;

    const today = new Date().toISOString().slice(0, 10);
    const pDate = prescription_date || today;

    // Find customer ID
    let [cust] = await query('SELECT id FROM customers WHERE user_id = ? OR email = ?', [req.user.id, req.user.email]);
    let customerId = cust[0]?.id;

    if (!customerId) {
      const [newCust] = await query(
        'INSERT INTO customers (user_id, customer_name, phone, email, address) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, req.user.name || 'Customer', '+1-555-0100', req.user.email, 'Prescription Patient Address']
      );
      customerId = newCust.insertId;
    }

    const filename = file ? file.filename : null;
    const originalName = file ? file.originalname : null;
    const mimeType = file ? file.mimetype : null;
    const fileSize = file ? file.size : null;
    const relativePath = file ? `/uploads/prescriptions/${file.filename}` : null;

    const [result] = await query(
      `INSERT INTO prescriptions 
       (customer_id, user_id, doctor_name, prescription_date, prescription_image, original_filename, file_path, file_type, file_size, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        customerId,
        req.user.id,
        doctor_name ? doctor_name.trim() : null,
        pDate,
        relativePath || filename,
        originalName,
        filename,
        mimeType,
        fileSize,
        notes ? notes.trim() : null,
      ]
    );

    const prescriptionId = result.insertId;

    // Create Notification
    await query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES (?, ?, ?, 'prescription', ?)`,
      [
        req.user.id,
        'Prescription Uploaded',
        'Your prescription was uploaded successfully and is currently under review by our licensed pharmacist.',
        '/customer/prescriptions',
      ]
    );

    await logAudit(req.user.id, 'UPLOAD_PRESCRIPTION', 'prescriptions', prescriptionId, {
      originalName,
      doctor_name,
    });

    const [created] = await query('SELECT * FROM prescriptions WHERE id = ?', [prescriptionId]);
    return ApiResponse.created(res, created[0], 'Prescription uploaded successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Securely stream / download prescription document
 * @route GET /api/v1/prescriptions/:id/file
 */
const getPrescriptionFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await query('SELECT * FROM prescriptions WHERE id = ?', [id]);

    if (rows.length === 0) {
      throw ApiError.notFound('Prescription not found');
    }

    const prescription = rows[0];

    // Authorization
    if (req.user?.role === 'customer' && prescription.user_id !== req.user.id) {
      throw ApiError.forbidden('You do not have permission to view this prescription document');
    }

    const filename = prescription.file_path || prescription.prescription_image;
    if (!filename) {
      throw ApiError.notFound('No file attached to this prescription');
    }

    // Sanitize file path
    const safeFilename = path.basename(filename);
    const fullPath = path.join(uploadDir, safeFilename);

    if (!fs.existsSync(fullPath)) {
      throw ApiError.notFound('Prescription file does not exist on server storage');
    }

    res.setHeader('Content-Type', prescription.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${prescription.original_filename || safeFilename}"`);
    return res.sendFile(fullPath);
  } catch (error) {
    next(error);
  }
};

/**
 * Create prescription (JSON payload backwards-compatible)
 * @route POST /api/v1/prescriptions
 */
const createPrescription = async (req, res, next) => {
  try {
    const { customer_id, doctor_name, prescription_date, prescription_image, notes } = req.body;

    const today = new Date().toISOString().slice(0, 10);
    const pDate = prescription_date || today;

    let targetCustomerId = customer_id || null;
    if (!targetCustomerId && req.user?.role === 'customer') {
      const [cust] = await query('SELECT id FROM customers WHERE user_id = ? OR email = ?', [req.user.id, req.user.email]);
      if (cust.length > 0) {
        targetCustomerId = cust[0].id;
      }
    }

    const [result] = await query(
      `INSERT INTO prescriptions (customer_id, user_id, doctor_name, prescription_date, prescription_image, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        targetCustomerId,
        req.user?.id || null,
        doctor_name ? doctor_name.trim() : null,
        pDate,
        prescription_image || null,
        notes ? notes.trim() : null,
      ]
    );

    const newPrescription = {
      id: result.insertId,
      customer_id: targetCustomerId,
      user_id: req.user?.id || null,
      doctor_name,
      prescription_date: pDate,
      prescription_image,
      notes,
      status: 'pending',
    };

    if (req.user?.id) {
      await query(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES (?, ?, ?, 'prescription', ?)`,
        [
          req.user.id,
          'Prescription Submitted',
          'Your prescription has been submitted and is pending review by our pharmacist.',
          '/customer/prescriptions',
        ]
      );
    }

    await logAudit(req.user?.id, 'CREATE_PRESCRIPTION', 'prescriptions', result.insertId, newPrescription);
    return ApiResponse.created(res, newPrescription, 'Prescription submitted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update prescription status (Pharmacist & Admin)
 * @route PATCH /api/v1/prescriptions/:id/status
 */
const updatePrescriptionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason, verification_remarks, notes } = req.body;

    let finalStatus = status;
    if (finalStatus === 'verified') finalStatus = 'approved';

    const validStatuses = ['pending', 'under_review', 'approved', 'rejected', 'dispensed'];
    if (!validStatuses.includes(finalStatus)) {
      throw ApiError.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Require reason if rejecting
    if (finalStatus === 'rejected' && (!rejection_reason || !rejection_reason.trim())) {
      throw ApiError.badRequest('A specific rejection reason is required when rejecting a prescription');
    }

    const [existing] = await query('SELECT * FROM prescriptions WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Prescription not found');
    }

    const current = existing[0];
    const updates = ['status = ?', 'verified_by = ?', 'verified_at = NOW()'];
    const params = [finalStatus, req.user.id];

    if (rejection_reason !== undefined) {
      updates.push('rejection_reason = ?');
      params.push(rejection_reason ? rejection_reason.trim() : null);
    }

    if (verification_remarks !== undefined) {
      updates.push('verification_remarks = ?');
      params.push(verification_remarks ? verification_remarks.trim() : null);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes ? notes.trim() : null);
    }

    if (finalStatus === 'dispensed') {
      updates.push('dispensed_by = ?', 'dispensed_at = NOW()');
      params.push(req.user.id);
    }

    params.push(id);
    await query(`UPDATE prescriptions SET ${updates.join(', ')} WHERE id = ?`, params);

    // Notify Customer
    if (current.user_id) {
      let notifTitle = `Prescription ${finalStatus.toUpperCase().replace('_', ' ')}`;
      let notifMsg = `Your prescription status is now ${finalStatus} (Reviewed by Pharmacist ${req.user.name}).`;
      if (finalStatus === 'approved') {
        notifMsg = `Great news! Your prescription has been approved by our licensed pharmacist. You may now proceed to order your prescribed medications.`;
      } else if (finalStatus === 'rejected') {
        notifMsg = `Your prescription could not be approved. Reason: ${rejection_reason || 'Unclear medication or invalid date'}. Please contact our pharmacy team.`;
      } else if (finalStatus === 'under_review') {
        notifMsg = `A licensed pharmacist is actively reviewing your prescription. We will update you shortly.`;
      } else if (finalStatus === 'dispensed') {
        notifMsg = `Your prescribed medications have been prepared and dispensed by our pharmacy team.`;
      }

      await query(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES (?, ?, ?, 'prescription', ?)`,
        [current.user_id, notifTitle, notifMsg, '/customer/prescriptions']
      );
    }

    await logAudit(req.user?.id, 'UPDATE_PRESCRIPTION_STATUS', 'prescriptions', id, {
      previousStatus: current.status,
      newStatus: finalStatus,
      rejection_reason,
      verification_remarks,
    });

    const [updated] = await query('SELECT * FROM prescriptions WHERE id = ?', [id]);
    return ApiResponse.success(res, updated[0], `Prescription marked as ${finalStatus}`);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete prescription (Admin only)
 * @route DELETE /api/v1/prescriptions/:id
 */
const deletePrescription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await query('SELECT * FROM prescriptions WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Prescription not found');
    }

    await query('DELETE FROM prescriptions WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'DELETE_PRESCRIPTION', 'prescriptions', id);

    return ApiResponse.success(res, null, 'Prescription deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  upload,
  getAllPrescriptions,
  getPrescriptionById,
  uploadPrescription,
  getPrescriptionFile,
  createPrescription,
  updatePrescriptionStatus,
  deletePrescription,
};
