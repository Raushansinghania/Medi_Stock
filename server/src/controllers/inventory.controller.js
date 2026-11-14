const { query, transaction } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

/**
 * Get stock movements log
 * @route GET /api/v1/inventory/movements
 */
const getStockMovements = async (req, res, next) => {
  try {
    const { medicine_id, movement_type, from_date, to_date, page = 1, limit = 50 } = req.query;

    let sql = `
      SELECT sm.*, m.medicine_name, m.batch_number, m.category
      FROM stock_movements sm
      JOIN medicines m ON sm.medicine_id = m.id
    `;
    const conditions = [];
    const params = [];

    if (medicine_id) {
      conditions.push('sm.medicine_id = ?');
      params.push(medicine_id);
    }
    if (movement_type) {
      conditions.push('sm.movement_type = ?');
      params.push(movement_type);
    }
    if (from_date) {
      conditions.push('sm.created_at >= ?');
      params.push(from_date);
    }
    if (to_date) {
      conditions.push('sm.created_at <= ?');
      params.push(to_date);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Count
    const [countRows] = await query(
      `SELECT COUNT(*) AS total FROM stock_movements sm ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}`,
      params
    );
    const totalDocs = countRows[0].total;

    sql += ' ORDER BY sm.id DESC LIMIT ? OFFSET ?';
    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await query(sql, [...params, Number(limit), Number(offset)]);

    return ApiResponse.paginated(
      res,
      rows,
      { page: Number(page), limit: Number(limit), totalDocs },
      'Stock movements retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get inventory valuation and stock health summary
 * @route GET /api/v1/inventory/summary
 */
const getInventorySummary = async (req, res, next) => {
  try {
    const [metrics] = await query(`
      SELECT 
        COUNT(*) AS total_medicines,
        COALESCE(SUM(quantity), 0) AS total_units_in_stock,
        COALESCE(SUM(quantity * purchase_price), 0) AS total_inventory_cost_valuation,
        COALESCE(SUM(quantity * selling_price), 0) AS total_inventory_retail_valuation,
        COALESCE(SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END), 0) AS out_of_stock_count,
        COALESCE(SUM(CASE WHEN quantity > 0 AND quantity <= 10 THEN 1 ELSE 0 END), 0) AS low_stock_count,
        COALESCE(SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 60 DAY) THEN 1 ELSE 0 END), 0) AS near_expiry_count
      FROM medicines
    `);

    // Category breakdown
    const [categoryBreakdown] = await query(`
      SELECT 
        COALESCE(category, 'Uncategorized') AS category,
        COUNT(*) AS medicine_count,
        COALESCE(SUM(quantity), 0) AS total_quantity,
        COALESCE(SUM(quantity * purchase_price), 0) AS valuation
      FROM medicines
      GROUP BY category
      ORDER BY total_quantity DESC
    `);

    return ApiResponse.success(
      res,
      {
        summary: metrics[0],
        categoryBreakdown,
      },
      'Inventory summary calculated successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Adjust stock manually
 * @route POST /api/v1/inventory/adjust
 */
const adjustStock = async (req, res, next) => {
  try {
    const { medicine_id, adjustment, notes } = req.body;

    const numAdj = Number(adjustment);
    if (isNaN(numAdj) || numAdj === 0) {
      throw ApiError.badRequest('Adjustment must be a non-zero number');
    }

    await transaction(async (conn) => {
      const [medRows] = await conn.execute(
        'SELECT id, quantity, medicine_name FROM medicines WHERE id = ? FOR UPDATE',
        [medicine_id]
      );

      if (medRows.length === 0) {
        throw ApiError.notFound('Medicine not found');
      }

      const med = medRows[0];
      const newQty = med.quantity + numAdj;
      if (newQty < 0) {
        throw ApiError.badRequest(
          `Cannot reduce stock by ${Math.abs(numAdj)}. Current available stock is ${med.quantity}.`
        );
      }

      await conn.execute('UPDATE medicines SET quantity = ? WHERE id = ?', [newQty, medicine_id]);

      await conn.execute(
        `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
         VALUES (?, 'adjustment', ?, 'manual_adjustment', ?, ?)`,
        [medicine_id, Math.abs(numAdj), medicine_id, notes || `Manual stock adjustment (${numAdj > 0 ? '+' : ''}${numAdj})`]
      );

      await logAudit(
        req.user?.id,
        'INVENTORY_ADJUST',
        'medicines',
        medicine_id,
        { oldQty: med.quantity, newQty, adjustment: numAdj, notes },
        conn
      );
    });

    const [updated] = await query('SELECT * FROM medicines WHERE id = ?', [medicine_id]);
    return ApiResponse.success(res, updated[0], 'Stock adjusted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get all medicine batches with expiry and quarantine status
 * @route GET /api/v1/inventory/batches
 */
const getAllBatches = async (req, res, next) => {
  try {
    const { search, status, medicine_id } = req.query;
    let sql = `
      SELECT b.*, m.medicine_name, m.category, m.manufacturer, m.strength, m.dosage_form,
             DATEDIFF(b.expiry_date, CURDATE()) AS days_left
      FROM medicine_batches b
      JOIN medicines m ON b.medicine_id = m.id
    `;
    const conditions = [];
    const params = [];

    if (search && search.trim()) {
      conditions.push('(b.batch_number LIKE ? OR m.medicine_name LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }
    if (medicine_id) {
      conditions.push('b.medicine_id = ?');
      params.push(medicine_id);
    }
    if (status === 'blocked') {
      conditions.push('b.is_blocked = 1');
    } else if (status === 'active') {
      conditions.push('b.is_blocked = 0 AND b.expiry_date >= CURDATE()');
    } else if (status === 'expired') {
      conditions.push('b.expiry_date < CURDATE()');
    } else if (status === 'near_expiry') {
      conditions.push('b.expiry_date >= CURDATE() AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)');
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY b.expiry_date ASC, b.id DESC';

    const [rows] = await query(sql, params);
    return ApiResponse.success(res, rows, 'Batches retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStockMovements,
  getInventorySummary,
  getAllBatches,
  adjustStock,
};
