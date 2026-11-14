const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

const getAllCustomers = async (req, res, next) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT c.*, COUNT(s.id) AS total_orders, COALESCE(SUM(s.total_amount), 0) AS total_spent
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id
    `;
    const params = [];

    if (search) {
      sql += ' WHERE c.customer_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ' GROUP BY c.id ORDER BY c.id DESC';
    const [rows] = await query(sql, params);
    return ApiResponse.success(res, rows, 'Customers retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await query('SELECT * FROM customers WHERE id = ?', [id]);
    if (rows.length === 0) {
      throw ApiError.notFound('Customer not found');
    }

    const [sales] = await query('SELECT * FROM sales WHERE customer_id = ? ORDER BY id DESC', [id]);
    const [orders] = await query('SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC', [id]);
    const [prescriptions] = await query('SELECT * FROM prescriptions WHERE customer_id = ? ORDER BY id DESC', [id]);

    return ApiResponse.success(
      res,
      { ...rows[0], sales, orders, prescriptions },
      'Customer details retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

const createCustomer = async (req, res, next) => {
  try {
    const { customer_name, phone, email, address } = req.body;
    if (!customer_name || !customer_name.trim()) {
      throw ApiError.badRequest('Customer name is required');
    }

    const [result] = await query(
      `INSERT INTO customers (customer_name, phone, email, address)
       VALUES (?, ?, ?, ?)`,
      [
        customer_name.trim(),
        phone ? phone.trim() : null,
        email ? email.trim() : null,
        address ? address.trim() : null,
      ]
    );

    const newCustomer = {
      id: result.insertId,
      customer_name: customer_name.trim(),
      phone,
      email,
      address,
    };

    await logAudit(req.user?.id, 'CREATE_CUSTOMER', 'customers', result.insertId, newCustomer);

    return ApiResponse.created(res, newCustomer, 'Customer created successfully');
  } catch (error) {
    next(error);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { customer_name, phone, email, address } = req.body;

    const [existing] = await query('SELECT * FROM customers WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Customer not found');
    }

    const updates = [];
    const params = [];

    if (customer_name !== undefined) {
      updates.push('customer_name = ?');
      params.push(customer_name.trim());
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

    if (updates.length === 0) {
      throw ApiError.badRequest('No update data provided');
    }

    params.push(id);
    await query(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await query('SELECT * FROM customers WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'UPDATE_CUSTOMER', 'customers', id, updated[0]);

    return ApiResponse.success(res, updated[0], 'Customer updated successfully');
  } catch (error) {
    next(error);
  }
};

const deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await query('SELECT * FROM customers WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Customer not found');
    }

    await query('DELETE FROM customers WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'DELETE_CUSTOMER', 'customers', id, { name: existing[0].customer_name });

    return ApiResponse.success(res, null, 'Customer deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Dedicated customer dashboard telemetry (strictly patient-isolated metrics)
 * @route GET /api/v1/customers/me/dashboard
 */
const getCustomerDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Customer record
    const [custRows] = await query('SELECT id, customer_name, phone, address FROM customers WHERE user_id = ? OR email = ?', [userId, userEmail]);
    const custId = custRows[0]?.id;

    // 1. Orders count & active count
    const [orderStats] = await query(`
      SELECT 
        COUNT(*) AS total_orders,
        COALESCE(SUM(CASE WHEN status IN ('pending', 'awaiting_prescription', 'confirmed', 'processing', 'ready_for_collection', 'shipped') THEN 1 ELSE 0 END), 0) AS active_orders,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END), 0) AS total_spent
      FROM orders
      WHERE user_id = ?
    `, [userId]);

    // 2. Prescriptions count & pending count
    const [rxStats] = await query(`
      SELECT 
        COUNT(*) AS total_prescriptions,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_prescriptions,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved_prescriptions
      FROM prescriptions
      WHERE user_id = ? ${custId ? 'OR customer_id = ' + custId : ''}
    `, [userId]);

    // 3. Unread notifications
    const [notifStats] = await query(`
      SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0
    `, [userId]);

    // 4. Invoices / Sales count
    const [saleStats] = await query(`
      SELECT COUNT(*) AS total_invoices FROM sales WHERE customer_id = ?
    `, [custId || 0]);

    // 5. Recent 4 orders
    const [recentOrders] = await query(`
      SELECT o.id, o.order_number, o.created_at, o.status, o.total_amount, o.order_type,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
      FROM orders o
      WHERE o.user_id = ?
      ORDER BY o.id DESC
      LIMIT 4
    `, [userId]);

    // 6. Recent 4 prescriptions
    const [recentPrescriptions] = await query(`
      SELECT p.id, p.doctor_name, p.prescription_date, p.status, p.rejection_reason, p.created_at
      FROM prescriptions p
      WHERE p.user_id = ? ${custId ? 'OR p.customer_id = ' + custId : ''}
      ORDER BY p.id DESC
      LIMIT 4
    `, [userId]);

    return ApiResponse.success(res, {
      profile: {
        name: req.user.name,
        email: req.user.email,
        phone: custRows[0]?.phone || 'Not provided',
        address: custRows[0]?.address || 'Not provided',
      },
      stats: {
        totalOrders: orderStats[0].total_orders,
        activeOrders: orderStats[0].active_orders,
        totalSpent: Number(orderStats[0].total_spent || 0),
        totalPrescriptions: rxStats[0].total_prescriptions,
        pendingPrescriptions: rxStats[0].pending_prescriptions,
        approvedPrescriptions: rxStats[0].approved_prescriptions,
        totalInvoices: saleStats[0].total_invoices,
        unreadNotifications: notifStats[0].unread_count,
      },
      recentOrders,
      recentPrescriptions,
    }, 'Customer dashboard stats loaded');
  } catch (error) {
    next(error);
  }
};

/**
 * Get current customer profile
 * @route GET /api/v1/customers/me/profile
 */
const getCustomerProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [custRows] = await query('SELECT * FROM customers WHERE user_id = ? OR email = ?', [userId, req.user.email]);
    const cust = custRows[0] || {};

    return ApiResponse.success(res, {
      id: cust.id || null,
      userId,
      name: req.user.name,
      email: req.user.email,
      phone: cust.phone || '',
      address: cust.address || '',
      created_at: cust.created_at || req.user.created_at,
    }, 'Profile retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * Update current customer profile
 * @route PUT /api/v1/customers/me/profile
 */
const updateCustomerProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, phone, address } = req.body;

    if (name && name.trim()) {
      await query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), userId]);
    }

    const [existing] = await query('SELECT id FROM customers WHERE user_id = ? OR email = ?', [userId, req.user.email]);
    if (existing.length > 0) {
      await query(
        'UPDATE customers SET customer_name = COALESCE(?, customer_name), phone = COALESCE(?, phone), address = COALESCE(?, address), user_id = ? WHERE id = ?',
        [name ? name.trim() : null, phone ? phone.trim() : null, address ? address.trim() : null, userId, existing[0].id]
      );
    } else {
      await query(
        'INSERT INTO customers (user_id, customer_name, phone, email, address) VALUES (?, ?, ?, ?, ?)',
        [userId, name ? name.trim() : req.user.name, phone ? phone.trim() : null, req.user.email, address ? address.trim() : null]
      );
    }

    await logAudit(userId, 'UPDATE_PROFILE', 'users', userId);

    const [updatedUser] = await query('SELECT id, name, email, role FROM users WHERE id = ?', [userId]);
    const [updatedCust] = await query('SELECT * FROM customers WHERE user_id = ? OR email = ?', [userId, req.user.email]);

    return ApiResponse.success(res, {
      user: updatedUser[0],
      customer: updatedCust[0],
    }, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Change customer password
 * @route PUT /api/v1/customers/me/change-password
 */
const changeCustomerPassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      throw ApiError.badRequest('Current password and new password are required');
    }

    if (new_password.length < 6) {
      throw ApiError.badRequest('New password must be at least 6 characters');
    }

    const [users] = await query('SELECT password FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      throw ApiError.notFound('User not found');
    }

    const isMatch = await bcrypt.compare(current_password, users[0].password);
    if (!isMatch) {
      throw ApiError.unauthorized('Current password is incorrect');
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(new_password, salt);

    await query('UPDATE users SET password = ? WHERE id = ?', [newHash, userId]);
    await logAudit(userId, 'PASSWORD_CHANGED', 'users', userId);

    return ApiResponse.success(res, null, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerDashboard,
  getCustomerProfile,
  updateCustomerProfile,
  changeCustomerPassword,
};
