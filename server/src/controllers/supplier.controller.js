const { query } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

const getAllSuppliers = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    let sql = `
      SELECT s.*,
             COUNT(p.id) AS total_orders,
             COALESCE(SUM(p.total_amount), 0) AS total_purchases,
             COALESCE(SUM(CASE WHEN p.status = 'received' THEN p.total_amount ELSE 0 END), 0) AS total_paid,
             COALESCE(SUM(CASE WHEN p.status IN ('ordered', 'pending_approval') THEN p.total_amount ELSE 0 END), 0) AS outstanding_balance
      FROM suppliers s
      LEFT JOIN purchases p ON s.id = p.supplier_id
    `;
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(s.supplier_name LIKE ? OR s.contact_person LIKE ? OR s.phone LIKE ? OR s.email LIKE ? OR s.gstin LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }
    if (status) {
      conditions.push('s.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' GROUP BY s.id ORDER BY s.id DESC';
    const [rows] = await query(sql, params);
    return ApiResponse.success(res, rows, 'Suppliers fetched successfully');
  } catch (error) {
    next(error);
  }
};

const getSupplierById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (rows.length === 0) {
      throw ApiError.notFound('Supplier not found');
    }

    // Also fetch purchase history for this supplier
    const [purchases] = await query('SELECT * FROM purchases WHERE supplier_id = ? ORDER BY id DESC', [id]);

    const totalPurchases = purchases.reduce((acc, p) => acc + Number(p.total_amount || 0), 0);
    const totalPaid = purchases
      .filter((p) => p.status === 'received')
      .reduce((acc, p) => acc + Number(p.total_amount || 0), 0);
    const outstanding = purchases
      .filter((p) => ['ordered', 'pending_approval'].includes(p.status))
      .reduce((acc, p) => acc + Number(p.total_amount || 0), 0);

    return ApiResponse.success(
      res,
      {
        ...rows[0],
        totalPurchases,
        totalPaid,
        outstandingBalance: outstanding,
        purchases,
      },
      'Supplier retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

const createSupplier = async (req, res, next) => {
  try {
    const { supplier_name, contact_person, phone, email, address, gstin, payment_terms = 'Net 30', status = 'active' } = req.body;
    if (!supplier_name || !supplier_name.trim()) {
      throw ApiError.badRequest('Supplier name is required');
    }

    const [result] = await query(
      `INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, gstin, payment_terms, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        supplier_name.trim(),
        contact_person ? contact_person.trim() : null,
        phone ? phone.trim() : null,
        email ? email.trim() : null,
        address ? address.trim() : null,
        gstin ? gstin.trim() : null,
        payment_terms || 'Net 30',
        status || 'active',
      ]
    );

    const newSupplier = {
      id: result.insertId,
      supplier_name: supplier_name.trim(),
      contact_person,
      phone,
      email,
      address,
      gstin,
      payment_terms,
      status,
    };

    await logAudit(req.user?.id, 'CREATE_SUPPLIER', 'suppliers', result.insertId, newSupplier);

    return ApiResponse.created(res, newSupplier, 'Supplier created successfully');
  } catch (error) {
    next(error);
  }
};

const updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { supplier_name, contact_person, phone, email, address, gstin, payment_terms, status } = req.body;

    const [existing] = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Supplier not found');
    }

    const updates = [];
    const params = [];

    if (supplier_name !== undefined) {
      updates.push('supplier_name = ?');
      params.push(supplier_name.trim());
    }
    if (contact_person !== undefined) {
      updates.push('contact_person = ?');
      params.push(contact_person ? contact_person.trim() : null);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone ? phone.trim() : null);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email ? email.trim() : null);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      params.push(address ? address.trim() : null);
    }
    if (gstin !== undefined) {
      updates.push('gstin = ?');
      params.push(gstin ? gstin.trim() : null);
    }
    if (payment_terms !== undefined) {
      updates.push('payment_terms = ?');
      params.push(payment_terms);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      throw ApiError.badRequest('No update data provided');
    }

    params.push(id);
    await query(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'UPDATE_SUPPLIER', 'suppliers', id, updated[0]);

    return ApiResponse.success(res, updated[0], 'Supplier updated successfully');
  } catch (error) {
    next(error);
  }
};

const deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Supplier not found');
    }

    await query('DELETE FROM suppliers WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'DELETE_SUPPLIER', 'suppliers', id, { name: existing[0].supplier_name });

    return ApiResponse.success(res, null, 'Supplier deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
