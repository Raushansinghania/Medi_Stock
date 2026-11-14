const { query, transaction } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

const getAllPayments = async (req, res, next) => {
  try {
    const { sale_id, payment_method, status } = req.query;
    let sql = `
      SELECT p.*, s.invoice_number, s.total_amount AS sale_total, c.customer_name, s.customer_id
      FROM payments p
      JOIN sales s ON p.sale_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
    `;
    const conditions = [];
    const params = [];

    // Customer isolation
    if (req.user?.role === 'customer') {
      const [cust] = await query('SELECT id FROM customers WHERE email = ? OR user_id = ?', [req.user.email, req.user.id]);
      if (cust.length > 0) {
        conditions.push('s.customer_id = ?');
        params.push(cust[0].id);
      } else {
        return ApiResponse.success(res, [], 'No payments found');
      }
    }

    if (sale_id) {
      conditions.push('p.sale_id = ?');
      params.push(sale_id);
    }
    if (payment_method) {
      conditions.push('p.payment_method = ?');
      params.push(payment_method);
    }
    if (status) {
      conditions.push('p.payment_status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY p.id DESC';

    const [rows] = await query(sql, params);
    return ApiResponse.success(res, rows, 'Payments retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await query(
      `SELECT p.*, s.invoice_number, s.total_amount AS sale_total, c.customer_name, s.customer_id
       FROM payments p
       JOIN sales s ON p.sale_id = s.id
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE p.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw ApiError.notFound('Payment not found');
    }

    // Customer isolation check
    if (req.user?.role === 'customer') {
      const [cust] = await query('SELECT id FROM customers WHERE email = ? OR user_id = ?', [req.user.email, req.user.id]);
      if (!cust.length || cust[0].id !== rows[0].customer_id) {
        throw ApiError.forbidden('You do not have permission to view this payment record');
      }
    }

    return ApiResponse.success(res, rows[0], 'Payment retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const createPayment = async (req, res, next) => {
  try {
    const { sale_id, amount, payment_method = 'cash', payment_status = 'completed' } = req.body;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw ApiError.badRequest('Payment amount must be greater than zero');
    }

    const [sales] = await query('SELECT id, invoice_number, total_amount FROM sales WHERE id = ?', [sale_id]);
    if (sales.length === 0) {
      throw ApiError.notFound('Sale record not found');
    }

    const sale = sales[0];

    const [resInsert] = await query(
      `INSERT INTO payments (sale_id, amount, payment_method, payment_status)
       VALUES (?, ?, ?, ?)`,
      [sale_id, numAmount, payment_method, payment_status]
    );

    await logAudit(
      req.user?.id,
      'CREATE_PAYMENT',
      'payments',
      resInsert.insertId,
      { sale_id, invoice_number: sale.invoice_number, amount: numAmount, payment_method }
    );

    const [created] = await query('SELECT * FROM payments WHERE id = ?', [resInsert.insertId]);
    return ApiResponse.created(res, created[0], 'Payment recorded successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPayments,
  getPaymentById,
  createPayment,
};
