const { query, transaction } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

/**
 * Get all returns
 * @route GET /api/v1/returns
 */
const getAllReturns = async (req, res, next) => {
  try {
    const { sale_id, medicine_id, customer_id } = req.query;
    let sql = `
      SELECT r.*, s.invoice_number, m.medicine_name, c.customer_name
      FROM returns r
      JOIN sales s ON r.sale_id = s.id
      JOIN medicines m ON r.medicine_id = m.id
      LEFT JOIN customers c ON r.customer_id = c.id
    `;
    const conditions = [];
    const params = [];

    if (sale_id) {
      conditions.push('r.sale_id = ?');
      params.push(sale_id);
    }
    if (medicine_id) {
      conditions.push('r.medicine_id = ?');
      params.push(medicine_id);
    }
    if (customer_id) {
      conditions.push('r.customer_id = ?');
      params.push(customer_id);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY r.id DESC';

    const [rows] = await query(sql, params);
    return ApiResponse.success(res, rows, 'Returns fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get return by ID
 * @route GET /api/v1/returns/:id
 */
const getReturnById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await query(
      `SELECT r.*, s.invoice_number, m.medicine_name, c.customer_name
       FROM returns r
       JOIN sales s ON r.sale_id = s.id
       JOIN medicines m ON r.medicine_id = m.id
       LEFT JOIN customers c ON r.customer_id = c.id
       WHERE r.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw ApiError.notFound('Return record not found');
    }

    return ApiResponse.success(res, rows[0], 'Return retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Process a return and restore stock atomically
 * @route POST /api/v1/returns
 */
const processReturn = async (req, res, next) => {
  try {
    const { sale_id, medicine_id, quantity, return_reason, refund_amount } = req.body;

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      throw ApiError.badRequest('Valid quantity greater than zero is required');
    }

    const returnId = await transaction(async (conn) => {
      // 1. Verify sale exists
      const [sales] = await conn.execute(
        'SELECT id, customer_id, invoice_number FROM sales WHERE id = ?',
        [sale_id]
      );
      if (sales.length === 0) {
        throw ApiError.notFound('Sale record not found');
      }
      const sale = sales[0];

      // 2. Verify medicine was part of this sale and check quantity
      const [saleItems] = await conn.execute(
        'SELECT id, quantity, unit_price FROM sale_items WHERE sale_id = ? AND medicine_id = ?',
        [sale_id, medicine_id]
      );
      if (saleItems.length === 0) {
        throw ApiError.badRequest('This medicine is not associated with the specified sale invoice');
      }

      // Check how many have already been returned for this sale & medicine
      const [prevReturns] = await conn.execute(
        'SELECT COALESCE(SUM(quantity), 0) AS total_returned FROM returns WHERE sale_id = ? AND medicine_id = ?',
        [sale_id, medicine_id]
      );
      const alreadyReturned = Number(prevReturns[0].total_returned);
      const maxReturnable = saleItems[0].quantity - alreadyReturned;

      if (numQty > maxReturnable) {
        throw ApiError.badRequest(
          `Cannot return ${numQty} units. Maximum returnable quantity is ${maxReturnable} (Purchased: ${saleItems[0].quantity}, Already Returned: ${alreadyReturned})`
        );
      }

      // Calculate refund amount if not supplied
      const refAmount =
        refund_amount !== undefined
          ? Number(refund_amount)
          : Math.round(numQty * Number(saleItems[0].unit_price) * 100) / 100;

      const reasonText = return_reason ? return_reason.trim() : 'Customer return';
      const today = new Date().toISOString().slice(0, 10);

      // 3. Insert return record
      const [retRes] = await conn.execute(
        `INSERT INTO returns (sale_id, medicine_id, customer_id, return_date, quantity, return_reason, reason, refund_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sale_id,
          medicine_id,
          sale.customer_id || null,
          today,
          numQty,
          reasonText,
          reasonText,
          refAmount,
        ]
      );
      const newReturnId = retRes.insertId;

      // 4. Restore medicine stock
      const [medRows] = await conn.execute(
        'SELECT id, quantity, medicine_name FROM medicines WHERE id = ? FOR UPDATE',
        [medicine_id]
      );
      if (medRows.length === 0) {
        throw ApiError.notFound('Medicine not found');
      }

      const newStock = medRows[0].quantity + numQty;
      await conn.execute('UPDATE medicines SET quantity = ? WHERE id = ?', [newStock, medicine_id]);

      // 5. Record stock movement (movement_type: 'return')
      await conn.execute(
        `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
         VALUES (?, 'return', ?, 'return', ?, ?)`,
        [
          medicine_id,
          numQty,
          newReturnId,
          `Restored stock from return (Sale #${sale.invoice_number}, Reason: ${return_reason || 'N/A'})`,
        ]
      );

      // 6. Record audit log
      await logAudit(
        req.user?.id,
        'PROCESS_RETURN',
        'returns',
        newReturnId,
        {
          sale_id,
          medicine_id,
          quantity: numQty,
          refund_amount: refAmount,
          medicine_name: medRows[0].medicine_name,
        },
        conn
      );

      return newReturnId;
    });

    const [created] = await query('SELECT * FROM returns WHERE id = ?', [returnId]);
    return ApiResponse.created(res, created[0], 'Return processed and stock restored successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllReturns,
  getReturnById,
  processReturn,
};
