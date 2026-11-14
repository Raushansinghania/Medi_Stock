const { query, transaction } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

/**
 * Get comprehensive Pharmacist Dashboard metrics from live MySQL database
 * @route GET /api/v1/pharmacist/dashboard
 */
const getPharmacistDashboard = async (req, res, next) => {
  try {
    // 1. Today's total sales amount
    const [todaySalesRows] = await query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) AS today_sales,
        COUNT(*) AS today_bills
      FROM sales
      WHERE sale_date = CURDATE()
    `);

    // 2. Prescription counts by status
    const [rxStats] = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status IN ('pending', 'under_review') THEN 1 ELSE 0 END), 0) AS pending_rx,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved_rx,
        COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_rx,
        COALESCE(SUM(CASE WHEN status = 'dispensed' THEN 1 ELSE 0 END), 0) AS dispensed_rx
      FROM prescriptions
    `);

    // 3. Low stock medicines count
    const [lowStock] = await query(`
      SELECT COUNT(*) AS low_stock_count
      FROM medicines
      WHERE quantity <= 15
    `);

    // 4. Near expiry and expired batches count
    const [expiryCounts] = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN expiry_date < CURDATE() THEN 1 ELSE 0 END), 0) AS expired_batches_count,
        COALESCE(SUM(CASE WHEN expiry_date >= CURDATE() AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) AND is_blocked = 0 THEN 1 ELSE 0 END), 0) AS near_expiry_count
      FROM medicine_batches
    `);

    // 5. Today's total dispensed units
    const [dispensedToday] = await query(`
      SELECT COALESCE(SUM(si.quantity), 0) AS today_dispensed
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.sale_date = CURDATE()
    `);

    // 6. Recent 5 sales
    const [recentSales] = await query(`
      SELECT s.id, s.invoice_number, s.sale_date, s.total_amount, s.payment_method,
             c.customer_name,
             (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS items_count
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.id DESC
      LIMIT 6
    `);

    // 7. Pending prescription queue (pending & under_review)
    const [pendingRxQueue] = await query(`
      SELECT p.id, p.doctor_name, p.prescription_date, p.created_at, p.status, p.original_filename, p.file_type,
             c.customer_name, c.phone AS customer_phone
      FROM prescriptions p
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE p.status IN ('pending', 'under_review')
      ORDER BY p.id ASC
      LIMIT 6
    `);

    // 8. Low stock alerts (top 6 critical)
    const [lowStockList] = await query(`
      SELECT id, medicine_name, category, manufacturer, quantity, strength, dosage_form
      FROM medicines
      WHERE quantity <= 15
      ORDER BY quantity ASC
      LIMIT 6
    `);

    // 9. Expiry alerts (expired or expiring within 90 days)
    const [expiryAlerts] = await query(`
      SELECT b.id, b.batch_number, b.quantity, b.expiry_date, b.is_blocked, b.blocked_reason,
             m.medicine_name, m.category,
             DATEDIFF(b.expiry_date, CURDATE()) AS days_left
      FROM medicine_batches b
      JOIN medicines m ON b.medicine_id = m.id
      WHERE b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
      ORDER BY b.expiry_date ASC
      LIMIT 8
    `);

    // 10. Recent dispensing activity
    const [recentDispensing] = await query(`
      SELECT si.id, si.quantity, si.unit_price, si.subtotal, si.batch_number,
             s.invoice_number, s.sale_date, s.created_at,
             m.medicine_name, m.strength,
             c.customer_name
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN medicines m ON si.medicine_id = m.id
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY si.id DESC
      LIMIT 8
    `);

    // 11. Daily Sales trend (last 14 days) for operational chart
    const [dailySales] = await query(`
      SELECT 
        s.sale_date AS date,
        COALESCE(SUM(s.total_amount), 0) AS revenue,
        COUNT(s.id) AS bills
      FROM sales s
      WHERE s.sale_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
      GROUP BY s.sale_date
      ORDER BY s.sale_date ASC
    `);

    return ApiResponse.success(res, {
      stats: {
        todaySales: Number(todaySalesRows[0]?.today_sales || 0),
        todayBills: Number(todaySalesRows[0]?.today_bills || 0),
        pendingPrescriptions: Number(rxStats[0]?.pending_rx || 0),
        approvedPrescriptions: Number(rxStats[0]?.approved_rx || 0),
        rejectedPrescriptions: Number(rxStats[0]?.rejected_rx || 0),
        dispensedPrescriptions: Number(rxStats[0]?.dispensed_rx || 0),
        lowStockCount: Number(lowStock[0]?.low_stock_count || 0),
        nearExpiryCount: Number(expiryCounts[0]?.near_expiry_count || 0),
        expiredBatchesCount: Number(expiryCounts[0]?.expired_batches_count || 0),
        todayDispensedUnits: Number(dispensedToday[0]?.today_dispensed || 0),
      },
      recentSales,
      pendingRxQueue,
      lowStockList,
      expiryAlerts,
      recentDispensing,
      dailySales,
    }, 'Pharmacist dashboard telemetry retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * FEFO Batch Allocation Calculation Engine
 * Given a medicine_id and requested quantity, calculates automatic batch allocation in FEFO order.
 * @route GET /api/v1/pharmacist/fefo/calculate
 */
const calculateFEFO = async (req, res, next) => {
  try {
    const { medicine_id, quantity } = req.query;
    const medId = Number(medicine_id);
    const reqQty = Number(quantity);

    if (!medId || isNaN(medId)) {
      throw ApiError.badRequest('Valid medicine_id is required');
    }
    if (!reqQty || isNaN(reqQty) || reqQty <= 0) {
      throw ApiError.badRequest('Valid quantity greater than zero is required');
    }

    // Verify medicine exists
    const [medRows] = await query('SELECT * FROM medicines WHERE id = ?', [medId]);
    if (medRows.length === 0) {
      throw ApiError.notFound('Medicine not found');
    }
    const med = medRows[0];

    // Fetch active, non-blocked, unexpired batches sorted by FEFO (expiry_date ASC)
    const [batches] = await query(`
      SELECT id, batch_number, quantity, expiry_date, is_blocked, selling_price, mrp,
             DATEDIFF(expiry_date, CURDATE()) AS days_until_expiry
      FROM medicine_batches
      WHERE medicine_id = ?
        AND is_blocked = 0
        AND expiry_date >= CURDATE()
        AND quantity > 0
      ORDER BY expiry_date ASC, id ASC
    `, [medId]);

    // Calculate allocation across available batches
    let remainingToAllocate = reqQty;
    const allocations = [];

    for (const b of batches) {
      if (remainingToAllocate <= 0) break;

      const takeQty = Math.min(b.quantity, remainingToAllocate);
      allocations.push({
        batch_id: b.id,
        batch_number: b.batch_number,
        expiry_date: b.expiry_date,
        days_until_expiry: b.days_until_expiry,
        available_in_batch: b.quantity,
        allocated_qty: takeQty,
        remaining_in_batch_after: b.quantity - takeQty,
        selling_price: Number(b.selling_price || med.selling_price),
      });

      remainingToAllocate -= takeQty;
    }

    const totalAllocated = reqQty - remainingToAllocate;
    const isFullyAllocated = remainingToAllocate === 0;

    return ApiResponse.success(res, {
      medicine: {
        id: med.id,
        medicine_name: med.medicine_name,
        category: med.category,
        total_in_stock: med.quantity,
      },
      requested_quantity: reqQty,
      total_allocated: totalAllocated,
      unallocated_quantity: remainingToAllocate,
      is_fully_allocated: isFullyAllocated,
      allocations,
      has_batches: batches.length > 0,
    }, 'FEFO batch allocation calculated');
  } catch (error) {
    next(error);
  }
};

/**
 * Get Expiry Monitoring Breakdown (<30d, <60d, <90d, expired)
 * @route GET /api/v1/pharmacist/expiry-monitoring
 */
const getExpiryMonitoring = async (req, res, next) => {
  try {
    const { category, search } = req.query;

    let baseSql = `
      SELECT b.id, b.batch_number, b.quantity, b.initial_quantity, b.expiry_date, b.is_blocked, b.blocked_reason,
             b.selling_price, b.mrp,
             m.id AS medicine_id, m.medicine_name, m.category, m.manufacturer, m.strength,
             DATEDIFF(b.expiry_date, CURDATE()) AS days_left
      FROM medicine_batches b
      JOIN medicines m ON b.medicine_id = m.id
    `;
    const conditions = [];
    const params = [];

    if (category) {
      conditions.push('m.category = ?');
      params.push(category);
    }
    if (search) {
      conditions.push('(m.medicine_name LIKE ? OR b.batch_number LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    if (conditions.length > 0) {
      baseSql += ` WHERE ${conditions.join(' AND ')}`;
    }

    baseSql += ' ORDER BY b.expiry_date ASC';

    const [rows] = await query(baseSql, params);

    // Group rows into 4 distinct clinical expiry buckets
    const expired = rows.filter((r) => r.days_left < 0);
    const within30Days = rows.filter((r) => r.days_left >= 0 && r.days_left <= 30);
    const within60Days = rows.filter((r) => r.days_left > 30 && r.days_left <= 60);
    const within90Days = rows.filter((r) => r.days_left > 60 && r.days_left <= 90);
    const safeStock = rows.filter((r) => r.days_left > 90);

    return ApiResponse.success(res, {
      summary: {
        totalExpired: expired.length,
        totalWithin30: within30Days.length,
        totalWithin60: within60Days.length,
        totalWithin90: within90Days.length,
        totalSafe: safeStock.length,
      },
      expired,
      within30Days,
      within60Days,
      within90Days,
      safeStock,
    }, 'Expiry monitoring breakdown retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * Block/Quarantine a batch from dispensing
 * @route POST /api/v1/pharmacist/batches/:id/block
 */
const blockBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [batchRows] = await query('SELECT * FROM medicine_batches WHERE id = ?', [id]);
    if (batchRows.length === 0) {
      throw ApiError.notFound('Batch not found');
    }
    const b = batchRows[0];

    const blockReason = reason ? reason.trim() : 'Blocked by pharmacist for inspection / expiry';

    await query(
      'UPDATE medicine_batches SET is_blocked = 1, blocked_reason = ? WHERE id = ?',
      [blockReason, id]
    );

    // Recalculate medicine total stock subtracting blocked batch
    const [stockSum] = await query(
      'SELECT COALESCE(SUM(quantity), 0) AS total FROM medicine_batches WHERE medicine_id = ? AND is_blocked = 0 AND expiry_date >= CURDATE()',
      [b.medicine_id]
    );
    await query('UPDATE medicines SET quantity = ? WHERE id = ?', [stockSum[0].total, b.medicine_id]);

    await logAudit(
      req.user?.id,
      'BLOCK_BATCH',
      'medicine_batches',
      id,
      { batch_number: b.batch_number, reason: blockReason }
    );

    const [updated] = await query('SELECT * FROM medicine_batches WHERE id = ?', [id]);
    return ApiResponse.success(res, updated[0], 'Batch quarantined and blocked from dispensing');
  } catch (error) {
    next(error);
  }
};

/**
 * Unblock a previously quarantined batch
 * @route POST /api/v1/pharmacist/batches/:id/unblock
 */
const unblockBatch = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [batchRows] = await query('SELECT * FROM medicine_batches WHERE id = ?', [id]);
    if (batchRows.length === 0) {
      throw ApiError.notFound('Batch not found');
    }
    const b = batchRows[0];

    // Cannot unblock if already expired
    const isExpired = new Date(b.expiry_date) < new Date();
    if (isExpired) {
      throw ApiError.badRequest('Cannot unblock an expired batch. Expired stock must remain blocked.');
    }

    await query('UPDATE medicine_batches SET is_blocked = 0, blocked_reason = NULL WHERE id = ?', [id]);

    const [stockSum] = await query(
      'SELECT COALESCE(SUM(quantity), 0) AS total FROM medicine_batches WHERE medicine_id = ? AND is_blocked = 0 AND expiry_date >= CURDATE()',
      [b.medicine_id]
    );
    await query('UPDATE medicines SET quantity = ? WHERE id = ?', [stockSum[0].total, b.medicine_id]);

    await logAudit(req.user?.id, 'UNBLOCK_BATCH', 'medicine_batches', id, { batch_number: b.batch_number });

    const [updated] = await query('SELECT * FROM medicine_batches WHERE id = ?', [id]);
    return ApiResponse.success(res, updated[0], 'Batch restored to active dispensing inventory');
  } catch (error) {
    next(error);
  }
};

/**
 * Return Inspection Workflow (Req 10): Inspect returned medicine
 * Pharmacist inspects medicine to classify as 'approved_restock' or 'damaged_discarded'
 * @route POST /api/v1/pharmacist/returns/:id/inspect
 */
const inspectReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    let action = req.body.action;
    if (!action && req.body.status) {
      action = req.body.status === 'approved_restock' || req.body.status === 'restock' ? 'restock' : 'discard';
    }

    if (!['restock', 'discard'].includes(action)) {
      throw ApiError.badRequest("Action must be either 'restock' or 'discard'");
    }

    const inspection_notes = req.body.inspection_notes || req.body.notes;

    const [retRows] = await query('SELECT * FROM returns WHERE id = ?', [id]);
    if (retRows.length === 0) {
      throw ApiError.notFound('Return record not found');
    }
    const ret = retRows[0];

    if (ret.inspection_status !== 'pending_inspection') {
      throw ApiError.badRequest(`This return has already been inspected (Current Status: ${ret.inspection_status})`);
    }

    const newStatus = action === 'restock' ? 'approved_restock' : 'damaged_discarded';
    const notes = inspection_notes ? inspection_notes.trim() : `Inspected by Pharmacist ${req.user.name}`;

    await transaction(async (conn) => {
      // 1. Update return record
      await conn.execute(
        `UPDATE returns 
         SET inspection_status = ?, inspected_by = ?, inspection_notes = ? 
         WHERE id = ?`,
        [newStatus, req.user.id, notes, id]
      );

      // 2. If approved for restock, safely add back to sellable inventory
      if (action === 'restock') {
        const [medRows] = await conn.execute(
          'SELECT id, quantity, medicine_name FROM medicines WHERE id = ? FOR UPDATE',
          [ret.medicine_id]
        );
        if (medRows.length > 0) {
          const newQty = medRows[0].quantity + ret.quantity;
          await conn.execute('UPDATE medicines SET quantity = ? WHERE id = ?', [newQty, ret.medicine_id]);

          // Also increment primary active batch
          await conn.execute(
            `UPDATE medicine_batches 
             SET quantity = quantity + ? 
             WHERE medicine_id = ? AND is_blocked = 0 AND expiry_date >= CURDATE()
             ORDER BY expiry_date ASC LIMIT 1`,
            [ret.quantity, ret.medicine_id]
          );

          await conn.execute(
            `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
             VALUES (?, 'return', ?, 'return_inspection', ?, ?)`,
            [ret.medicine_id, ret.quantity, id, `Restocked into sellable inventory after pharmacist inspection: ${notes}`]
          );
        }
      } else {
        // Discarded / Damaged - record stock movement without increasing sellable stock
        await conn.execute(
          `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
           VALUES (?, 'adjustment', ?, 'return_discard', ?, ?)`,
          [ret.medicine_id, ret.quantity, id, `Classified as damaged/unfit for resale. Discarded: ${notes}`]
        );
      }

      await logAudit(
        req.user?.id,
        'INSPECT_RETURN',
        'returns',
        id,
        { action, status: newStatus, notes },
        conn
      );
    });

    const [updated] = await query('SELECT * FROM returns WHERE id = ?', [id]);
    return ApiResponse.success(res, updated[0], `Return successfully classified as '${newStatus}'`);
  } catch (error) {
    next(error);
  }
};

/**
 * Get dispensing activity history
 * @route GET /api/v1/pharmacist/dispensing-activity
 */
const getDispensingActivity = async (req, res, next) => {
  try {
    const { from_date, to_date, search, page = 1, limit = 50 } = req.query;

    let sql = `
      SELECT si.id, si.sale_id, si.medicine_id, si.batch_id, si.batch_number, si.quantity, si.unit_price, si.subtotal,
             s.invoice_number, s.sale_date, s.created_at, s.payment_method,
             m.medicine_name, m.dosage_form, m.strength, m.category,
             c.customer_name, c.phone AS customer_phone
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN medicines m ON si.medicine_id = m.id
      LEFT JOIN customers c ON s.customer_id = c.id
    `;
    const conditions = [];
    const params = [];

    if (from_date) {
      conditions.push('s.sale_date >= ?');
      params.push(from_date);
    }
    if (to_date) {
      conditions.push('s.sale_date <= ?');
      params.push(to_date);
    }
    if (search) {
      conditions.push('(m.medicine_name LIKE ? OR s.invoice_number LIKE ? OR si.batch_number LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY si.id DESC LIMIT ? OFFSET ?';
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await query(sql, [...params, Number(limit), Number(offset)]);
    return ApiResponse.success(res, rows, 'Dispensing activity log retrieved');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPharmacistDashboard,
  calculateFEFO,
  getExpiryMonitoring,
  blockBatch,
  unblockBatch,
  inspectReturn,
  getDispensingActivity,
};
