const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

/**
 * Helper to build SQL date condition
 */
const getDateCondition = (range, fromDate, toDate, dateField = 'sale_date') => {
  if (range === 'today') {
    return `${dateField} = CURDATE()`;
  } else if (range === '7days') {
    return `${dateField} >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
  } else if (range === '30days') {
    return `${dateField} >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
  } else if (range === 'this_month') {
    return `MONTH(${dateField}) = MONTH(CURDATE()) AND YEAR(${dateField}) = YEAR(CURDATE())`;
  } else if (range === 'last_month') {
    return `MONTH(${dateField}) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(${dateField}) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`;
  } else if (range === 'custom' && fromDate && toDate) {
    return `${dateField} BETWEEN '${fromDate}' AND '${toDate}'`;
  }
  return '1=1';
};

/**
 * Get comprehensive Admin Dashboard Telemetry
 * @route GET /api/v1/admin/dashboard
 */
const getAdminDashboardTelemetry = async (req, res, next) => {
  try {
    const { range = '30days', from_date, to_date } = req.query;
    const saleDateCond = getDateCondition(range, from_date, to_date, 's.sale_date');
    const purchaseDateCond = getDateCondition(range, from_date, to_date, 'p.purchase_date');
    const expenseDateCond = getDateCondition(range, from_date, to_date, 'e.expense_date');

    // 1. Business Overview KPIs
    const [bizKpis] = await query(`
      SELECT
        (SELECT COALESCE(SUM(s.total_amount), 0) FROM sales s WHERE s.status = 'completed' AND ${saleDateCond}) AS total_revenue,
        (SELECT COALESCE(SUM(p.total_amount), 0) FROM purchases p WHERE p.status = 'received' AND ${purchaseDateCond}) AS total_purchases,
        (SELECT COALESCE(SUM(si.quantity * COALESCE(mb.purchase_price, m.purchase_price, 0)), 0)
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN medicines m ON si.medicine_id = m.id
         LEFT JOIN medicine_batches mb ON si.batch_id = mb.id
         WHERE s.status = 'completed' AND ${saleDateCond}) AS cogs,
        (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE ${expenseDateCond}) AS total_expenses,
        (SELECT COALESCE(SUM(s.total_amount), 0) FROM sales s WHERE s.status = 'completed' AND s.sale_date = CURDATE()) AS today_sales,
        (SELECT COUNT(*) FROM sales s WHERE s.status = 'completed' AND s.sale_date = CURDATE()) AS today_bills_count,
        (SELECT COALESCE(SUM(s.total_amount), 0) FROM sales s WHERE s.status = 'completed' AND MONTH(s.sale_date) = MONTH(CURDATE()) AND YEAR(s.sale_date) = YEAR(CURDATE())) AS monthly_sales,
        (SELECT COUNT(*) FROM customers) AS total_customers,
        (SELECT COUNT(*) FROM users WHERE role IN ('admin', 'pharmacist', 'cashier')) AS total_employees
    `);

    const biz = bizKpis[0];
    const totalRev = Number(biz.total_revenue) || 0;
    const cogs = Number(biz.cogs) || 0;
    const grossProfit = Math.round((totalRev - cogs) * 100) / 100;
    const expenses = Number(biz.total_expenses) || 0;
    const netProfit = Math.round((grossProfit - expenses) * 100) / 100;
    const profitMargin = totalRev > 0 ? Math.round((netProfit / totalRev) * 1000) / 10 : 0;

    // 2. Inventory Overview KPIs
    const [invKpis] = await query(`
      SELECT
        (SELECT COUNT(*) FROM medicines) AS total_medicines,
        (SELECT COALESCE(SUM(quantity), 0) FROM medicines) AS total_available_stock,
        (SELECT COUNT(*) FROM medicines WHERE quantity <= COALESCE(reorder_level, 10)) AS low_stock_medicines,
        (SELECT COUNT(*) FROM medicine_batches WHERE expiry_date < CURDATE() AND quantity > 0) AS expired_batches,
        (SELECT COUNT(*) FROM medicine_batches WHERE expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY) AND quantity > 0) AS near_expiry_batches,
        (SELECT COALESCE(SUM(quantity * purchase_price), 0) FROM medicines) AS inventory_valuation
    `);

    // 3. Operational Overview KPIs
    const [opsKpis] = await query(`
      SELECT
        (SELECT COUNT(*) FROM prescriptions WHERE status = 'pending') AS pending_prescriptions,
        (SELECT COUNT(*) FROM prescriptions WHERE status = 'dispensed') AS completed_prescriptions,
        (SELECT COUNT(*) FROM sales WHERE sale_date = CURDATE()) AS today_invoices,
        (SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'processing')) AS pending_orders,
        (SELECT COUNT(*) FROM purchases WHERE status IN ('ordered', 'pending_approval')) AS pending_supplier_payments,
        (SELECT COUNT(*) FROM returns) AS recent_returns
    `);

    // 4. Interactive Charts
    // 4a. Daily Sales (last 14 days)
    const [dailySales] = await query(`
      SELECT 
        s.sale_date AS date,
        COALESCE(SUM(s.total_amount), 0) AS revenue,
        COUNT(s.id) AS bills
      FROM sales s
      WHERE s.status = 'completed' AND s.sale_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
      GROUP BY s.sale_date
      ORDER BY s.sale_date ASC
    `);

    // 4b. Monthly Revenue vs Purchases vs Expenses (last 6 months)
    const [monthlyTrend] = await query(`
      SELECT 
        DATE_FORMAT(s.sale_date, '%b %Y') AS month_label,
        DATE_FORMAT(s.sale_date, '%Y-%m') AS ym,
        COALESCE(SUM(s.total_amount), 0) AS sales_revenue,
        (
          SELECT COALESCE(SUM(p.total_amount), 0)
          FROM purchases p
          WHERE p.status = 'received' AND DATE_FORMAT(p.purchase_date, '%Y-%m') = DATE_FORMAT(MIN(s.sale_date), '%Y-%m')
        ) AS purchase_cost,
        (
          SELECT COALESCE(SUM(e.amount), 0)
          FROM expenses e
          WHERE DATE_FORMAT(e.expense_date, '%Y-%m') = DATE_FORMAT(MIN(s.sale_date), '%Y-%m')
        ) AS expenses
      FROM sales s
      WHERE s.status = 'completed' AND s.sale_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(s.sale_date, '%Y-%m'), DATE_FORMAT(s.sale_date, '%b %Y')
      ORDER BY ym ASC
    `);

    // 4c. Medicine Category Performance
    const [categoryPerformance] = await query(`
      SELECT 
        COALESCE(m.category, 'General') AS category,
        COALESCE(SUM(si.quantity), 0) AS units_sold,
        COALESCE(SUM(si.subtotal), 0) AS revenue
      FROM sale_items si
      JOIN medicines m ON si.medicine_id = m.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed'
      GROUP BY m.category
      ORDER BY revenue DESC
      LIMIT 6
    `);

    // 4d. Top-Selling Medicines
    const [topSellingMeds] = await query(`
      SELECT 
        m.id,
        m.medicine_name,
        m.category,
        COALESCE(SUM(si.quantity), 0) AS units_sold,
        COALESCE(SUM(si.subtotal), 0) AS total_revenue
      FROM sale_items si
      JOIN medicines m ON si.medicine_id = m.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed'
      GROUP BY m.id, m.medicine_name, m.category
      ORDER BY units_sold DESC
      LIMIT 5
    `);

    // 5. Alert Streams
    const [recentSales] = await query(`
      SELECT s.id, s.invoice_number, s.sale_date, s.total_amount, s.payment_method, s.status,
             c.customer_name, u.name AS pharmacist_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.pharmacist_id = u.id
      ORDER BY s.id DESC
      LIMIT 6
    `);

    const [pendingRxQueue] = await query(`
      SELECT p.id, p.customer_id, p.doctor_name, p.status, p.created_at,
             c.customer_name, c.phone AS customer_phone
      FROM prescriptions p
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE p.status = 'pending'
      ORDER BY p.id ASC
      LIMIT 5
    `);

    const [lowStockAlerts] = await query(`
      SELECT id, medicine_name, category, quantity, reorder_level, purchase_price, selling_price
      FROM medicines
      WHERE quantity <= COALESCE(reorder_level, 10)
      ORDER BY quantity ASC
      LIMIT 6
    `);

    const [expiringBatches] = await query(`
      SELECT mb.id, mb.batch_number, mb.expiry_date, mb.quantity, mb.is_blocked,
             m.medicine_name, m.category, DATEDIFF(mb.expiry_date, CURDATE()) AS days_left
      FROM medicine_batches mb
      JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.quantity > 0 AND mb.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
      ORDER BY mb.expiry_date ASC
      LIMIT 6
    `);

    return ApiResponse.success(res, {
      range,
      business: {
        ...biz,
        gross_profit: grossProfit,
        net_profit: netProfit,
        profit_margin: profitMargin,
      },
      inventory: invKpis[0],
      operations: opsKpis[0],
      charts: {
        dailySales,
        monthlyTrend,
        categoryPerformance,
        topSellingMeds,
      },
      alerts: {
        recentSales,
        pendingRxQueue,
        lowStockAlerts,
        expiringBatches,
      },
    }, 'Admin dashboard telemetry loaded');
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================================
 * EMPLOYEE & USER MANAGEMENT MODULE
 * ============================================================================
 */

/**
 * Get all staff employees (admin, pharmacist, cashier)
 * @route GET /api/v1/admin/employees
 */
const getAllEmployees = async (req, res, next) => {
  try {
    const { search, role, status } = req.query;
    let sql = "SELECT id, employee_id, name, email, phone, address, role, status, created_at FROM users WHERE role IN ('admin', 'pharmacist', 'cashier')";
    const params = [];

    if (search) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR employee_id LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }
    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY id ASC';

    const [employees] = await query(sql, params);
    return ApiResponse.success(res, employees, 'Employees retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new staff employee
 * @route POST /api/v1/admin/employees
 */
const createEmployee = async (req, res, next) => {
  try {
    const { name, email, password, role = 'pharmacist', phone, address, employee_id } = req.body;

    if (!name || !email || !password) {
      throw ApiError.badRequest('Name, email, and password are required');
    }

    if (!['admin', 'pharmacist', 'cashier'].includes(role)) {
      throw ApiError.badRequest("Invalid staff role. Must be 'admin', 'pharmacist', or 'cashier'");
    }

    if (password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters');
    }

    const emailTrimmed = email.toLowerCase().trim();
    const [existing] = await query('SELECT id FROM users WHERE email = ?', [emailTrimmed]);
    if (existing.length > 0) {
      throw ApiError.conflict(`An account with email '${email}' already exists`);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const empId = employee_id ? employee_id.trim() : `EMP-${role.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const [result] = await query(
      `INSERT INTO users (employee_id, name, email, password, role, phone, address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [empId, name.trim(), emailTrimmed, hashedPassword, role, phone || null, address || null]
    );

    const newEmpId = result.insertId;

    await logAudit(req.user.id, 'EMPLOYEE_CREATED', 'users', newEmpId, {
      name,
      email: emailTrimmed,
      role,
      employee_id: empId,
    });

    return ApiResponse.created(
      res,
      {
        id: newEmpId,
        employee_id: empId,
        name: name.trim(),
        email: emailTrimmed,
        role,
        phone,
        address,
        status: 'active',
      },
      'Employee account created successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update staff employee profile
 * @route PUT /api/v1/admin/employees/:id
 */
const updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, phone, address, status, employee_id } = req.body;

    const [existing] = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Employee not found');
    }

    const emp = existing[0];
    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (email) {
      const emailTrimmed = email.toLowerCase().trim();
      const [check] = await query('SELECT id FROM users WHERE email = ? AND id != ?', [emailTrimmed, id]);
      if (check.length > 0) throw ApiError.conflict('Email is already registered');
      updates.push('email = ?');
      params.push(emailTrimmed);
    }
    if (role) {
      if (!['admin', 'pharmacist', 'cashier'].includes(role)) {
        throw ApiError.badRequest("Role must be 'admin', 'pharmacist', or 'cashier'");
      }
      updates.push('role = ?');
      params.push(role);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      params.push(address);
    }
    if (status) {
      if (!['active', 'inactive'].includes(status)) {
        throw ApiError.badRequest("Status must be 'active' or 'inactive'");
      }
      // Prevent deactivating own account
      if (Number(id) === Number(req.user.id) && status === 'inactive') {
        throw ApiError.badRequest('Administrators cannot deactivate their own account');
      }
      updates.push('status = ?');
      params.push(status);
    }
    if (employee_id) {
      updates.push('employee_id = ?');
      params.push(employee_id.trim());
    }

    if (updates.length === 0) {
      throw ApiError.badRequest('No updates supplied');
    }

    params.push(id);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    await logAudit(req.user.id, 'EMPLOYEE_UPDATED', 'users', id, {
      previous: { role: emp.role, status: emp.status },
      updated: { role, status },
    });

    const [updated] = await query('SELECT id, employee_id, name, email, phone, address, role, status, created_at FROM users WHERE id = ?', [id]);
    return ApiResponse.success(res, updated[0], 'Employee updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Reset staff employee password securely
 * @route POST /api/v1/admin/employees/:id/reset-password
 */
const resetEmployeePassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      throw ApiError.badRequest('New password must be at least 6 characters long');
    }

    const [existing] = await query('SELECT id, name, email, role FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Employee account not found');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    await query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);

    await logAudit(req.user.id, 'EMPLOYEE_PASSWORD_RESET', 'users', id, {
      targetUser: existing[0].email,
      targetRole: existing[0].role,
    });

    return ApiResponse.success(res, { id: Number(id), message: 'Password reset successfully' }, 'Employee password has been reset');
  } catch (error) {
    next(error);
  }
};

/**
 * Get all system users (including Customers)
 * @route GET /api/v1/admin/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { search, role, status, page = 1, limit = 50 } = req.query;
    let sql = 'SELECT id, employee_id, name, email, phone, role, status, created_at FROM users WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (name LIKE ? OR email LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }
    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    const [countRows] = await query(`SELECT COUNT(*) AS total FROM (${sql}) AS t`, params);
    const totalDocs = countRows[0].total;

    sql += ' ORDER BY id ASC LIMIT ? OFFSET ?';
    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await query(sql, [...params, Number(limit), Number(offset)]);

    return ApiResponse.paginated(
      res,
      rows,
      { page: Number(page), limit: Number(limit), totalDocs },
      'Users retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle user account status (active/inactive)
 * @route PATCH /api/v1/admin/users/:id/status
 */
const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      throw ApiError.badRequest("Status must be 'active' or 'inactive'");
    }

    if (Number(id) === Number(req.user.id)) {
      throw ApiError.badRequest('Administrators cannot change their own active status');
    }

    const [existing] = await query('SELECT id, name, role, status FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('User not found');
    }

    await query('UPDATE users SET status = ? WHERE id = ?', [status, id]);

    await logAudit(req.user.id, 'USER_STATUS_TOGGLED', 'users', id, {
      previousStatus: existing[0].status,
      newStatus: status,
    });

    return ApiResponse.success(res, { id: Number(id), status }, `User status set to ${status}`);
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================================
 * PRESCRIPTION OVERSIGHT MODULE
 * ============================================================================
 */

/**
 * Get Prescription Oversight Dashboard metrics and review queue
 * @route GET /api/v1/admin/prescriptions/overview
 */
const getPrescriptionOversight = async (req, res, next) => {
  try {
    const [stats] = await query(`
      SELECT
        COUNT(*) AS total_prescriptions,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
        COALESCE(SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END), 0) AS under_review_count,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved_count,
        COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_count,
        COALESCE(SUM(CASE WHEN status = 'dispensed' THEN 1 ELSE 0 END), 0) AS dispensed_count
      FROM prescriptions
    `);

    const [recentReviews] = await query(`
      SELECT p.*, COALESCE(p.prescription_image, p.file_path) AS image_url,
             c.customer_name, c.email AS customer_email, c.phone AS customer_phone,
             u.name AS reviewer_name, d.name AS dispenser_name
      FROM prescriptions p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u ON p.verified_by = u.id
      LEFT JOIN users d ON p.dispensed_by = d.id
      ORDER BY p.id DESC
      LIMIT 20
    `);

    return ApiResponse.success(
      res,
      {
        metrics: stats[0],
        recentReviews,
      },
      'Prescription oversight telemetry retrieved'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================================
 * SALES & INVOICE MANAGEMENT MODULE
 * ============================================================================
 */

/**
 * Cancel a completed sale in an atomic transaction (controlled correction)
 * @route POST /api/v1/admin/sales/:id/cancel
 */
const cancelSale = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      throw ApiError.badRequest('A mandatory cancellation reason is required for financial compliance');
    }

    const [saleRows] = await query('SELECT * FROM sales WHERE id = ?', [id]);
    if (saleRows.length === 0) {
      throw ApiError.notFound('Sale transaction not found');
    }

    const sale = saleRows[0];
    if (sale.status === 'cancelled') {
      throw ApiError.badRequest('This invoice is already cancelled');
    }

    const [items] = await query('SELECT * FROM sale_items WHERE sale_id = ?', [id]);

    await transaction(async (conn) => {
      // 1. Update sale record to cancelled
      await conn.execute(
        `UPDATE sales
         SET status = 'cancelled', cancellation_reason = ?, cancelled_at = NOW(), cancelled_by = ?
         WHERE id = ?`,
        [reason.trim(), req.user.id, id]
      );

      // 2. Restore inventory quantities and batch allocations
      for (const item of items) {
        // Restore overall medicine stock
        await conn.execute('UPDATE medicines SET quantity = quantity + ? WHERE id = ?', [
          item.quantity,
          item.medicine_id,
        ]);

        // Restore batch quantity if batch_id exists
        if (item.batch_id) {
          await conn.execute('UPDATE medicine_batches SET quantity = quantity + ? WHERE id = ?', [
            item.quantity,
            item.batch_id,
          ]);
        }

        // Record reverse stock movement
        await conn.execute(
          `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
           VALUES (?, 'return', ?, 'sale_cancellation', ?, ?)`,
          [
            item.medicine_id,
            item.quantity,
            id,
            `Stock restored from cancelled invoice ${sale.invoice_number}: ${reason.trim()}`,
          ]
        );
      }

      // 3. Log audit event
      await logAudit(
        req.user.id,
        'SALE_INVOICE_CANCELLED',
        'sales',
        id,
        { invoice_number: sale.invoice_number, total_amount: sale.total_amount, reason: reason.trim() },
        conn
      );
    });

    const [cancelled] = await query('SELECT * FROM sales WHERE id = ?', [id]);
    return ApiResponse.success(res, cancelled[0], 'Sale invoice cancelled and inventory restored');
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================================
 * FINANCIAL MANAGEMENT & P&L ANALYTICS MODULE
 * ============================================================================
 */

/**
 * Get in-depth Financial Analytics
 * @route GET /api/v1/admin/finance/summary
 */
const getFinancialSummary = async (req, res, next) => {
  try {
    const { range = '30days', from_date, to_date } = req.query;
    const saleDateCond = getDateCondition(range, from_date, to_date, 's.sale_date');
    const purchaseDateCond = getDateCondition(range, from_date, to_date, 'p.purchase_date');
    const expenseDateCond = getDateCondition(range, from_date, to_date, 'e.expense_date');

    // Revenue & COGS
    const [rev] = await query(`
      SELECT 
        COALESCE(SUM(s.total_amount), 0) AS total_sales,
        COALESCE(SUM(s.subtotal), 0) AS gross_sales,
        COALESCE(SUM(s.tax), 0) AS sales_tax,
        COALESCE(SUM(s.discount), 0) AS discounts_given,
        COUNT(s.id) AS total_transactions,
        (
          SELECT COALESCE(SUM(si.quantity * COALESCE(mb.purchase_price, m.purchase_price, 0)), 0)
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          JOIN medicines m ON si.medicine_id = m.id
          LEFT JOIN medicine_batches mb ON si.batch_id = mb.id
          WHERE s.status = 'completed' AND ${saleDateCond}
        ) AS cogs
      FROM sales s
      WHERE s.status = 'completed' AND ${saleDateCond}
    `);

    // Operating expenses
    const [exp] = await query(`
      SELECT COALESCE(SUM(amount), 0) AS total_operating_expenses
      FROM expenses e
      WHERE ${expenseDateCond}
    `);

    // Expense breakdown by category
    const [expCats] = await query(`
      SELECT category, COALESCE(SUM(amount), 0) AS amount
      FROM expenses e
      WHERE ${expenseDateCond}
      GROUP BY category
      ORDER BY amount DESC
    `);

    // Payment methods breakdown
    const [paymentBreakdown] = await query(`
      SELECT 
        LOWER(COALESCE(payment_method, 'cash')) AS method,
        COALESCE(SUM(total_amount), 0) AS amount,
        COUNT(id) AS count
      FROM sales s
      WHERE s.status = 'completed' AND ${saleDateCond}
      GROUP BY LOWER(COALESCE(payment_method, 'cash'))
    `);

    // Purchases & Supplier Payables
    const [purchases] = await query(`
      SELECT 
        COALESCE(SUM(p.total_amount), 0) AS total_purchases,
        COALESCE(SUM(CASE WHEN p.status = 'received' THEN p.total_amount ELSE 0 END), 0) AS received_purchases,
        COALESCE(SUM(CASE WHEN p.status IN ('ordered', 'pending_approval') THEN p.total_amount ELSE 0 END), 0) AS outstanding_payables
      FROM purchases p
      WHERE ${purchaseDateCond}
    `);

    // Inventory Valuation & Losses
    const [inv] = await query(`
      SELECT
        (SELECT COALESCE(SUM(quantity * purchase_price), 0) FROM medicines) AS inventory_valuation_cost,
        (SELECT COALESCE(SUM(quantity * selling_price), 0) FROM medicines) AS inventory_valuation_retail,
        (SELECT COALESCE(SUM(quantity * purchase_price), 0) FROM medicine_batches WHERE expiry_date < CURDATE() AND quantity > 0) AS expired_stock_loss
    `);

    const totalSales = Number(rev[0].total_sales) || 0;
    const cogsVal = Number(rev[0].cogs) || 0;
    const grossProfit = Math.round((totalSales - cogsVal) * 100) / 100;
    const opExpenses = Number(exp[0].total_operating_expenses) || 0;
    const netProfit = Math.round((grossProfit - opExpenses) * 100) / 100;
    const grossMargin = totalSales > 0 ? Math.round((grossProfit / totalSales) * 1000) / 10 : 0;
    const netMargin = totalSales > 0 ? Math.round((netProfit / totalSales) * 1000) / 10 : 0;

    return ApiResponse.success(res, {
      pnl: {
        total_sales: totalSales,
        cogs: cogsVal,
        gross_profit: grossProfit,
        gross_margin: grossMargin,
        operating_expenses: opExpenses,
        net_profit: netProfit,
        net_margin: netMargin,
        sales_tax: Number(rev[0].sales_tax) || 0,
        discounts: Number(rev[0].discounts_given) || 0,
      },
      paymentBreakdown,
      expenseCategories: expCats,
      purchases: purchases[0],
      inventory: inv[0],
    }, 'Financial analytics calculated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================================
 * 12 REPORTS & ANALYTICS MODULE
 * ============================================================================
 */

/**
 * Generate 12 real database reports
 * @route GET /api/v1/admin/reports/:reportType
 */
const getReportData = async (req, res, next) => {
  try {
    const { reportType } = req.params;
    const { from_date, to_date, category, payment_method } = req.query;

    let data = [];
    let summary = {};

    switch (reportType) {
      case 'daily-sales': {
        const [rows] = await query(`
          SELECT s.sale_date, COUNT(s.id) AS bills,
                 COALESCE(SUM(s.subtotal), 0) AS subtotal,
                 COALESCE(SUM(s.tax), 0) AS tax,
                 COALESCE(SUM(s.discount), 0) AS discount,
                 COALESCE(SUM(s.total_amount), 0) AS total_revenue
          FROM sales s
          WHERE s.status = 'completed'
          ${from_date ? `AND s.sale_date >= '${from_date}'` : ''}
          ${to_date ? `AND s.sale_date <= '${to_date}'` : ''}
          GROUP BY s.sale_date
          ORDER BY s.sale_date DESC
          LIMIT 100
        `);
        data = rows;
        break;
      }

      case 'monthly-sales': {
        const [rows] = await query(`
          SELECT DATE_FORMAT(s.sale_date, '%Y-%m') AS month,
                 DATE_FORMAT(s.sale_date, '%M %Y') AS month_name,
                 COUNT(s.id) AS bills,
                 COALESCE(SUM(s.total_amount), 0) AS total_revenue
          FROM sales s
          WHERE s.status = 'completed'
          ${from_date ? `AND s.sale_date >= '${from_date}'` : ''}
          ${to_date ? `AND s.sale_date <= '${to_date}'` : ''}
          GROUP BY DATE_FORMAT(s.sale_date, '%Y-%m'), DATE_FORMAT(s.sale_date, '%M %Y')
          ORDER BY month DESC
        `);
        data = rows;
        break;
      }

      case 'purchases': {
        const [rows] = await query(`
          SELECT p.id, p.invoice_number, p.purchase_date, p.total_amount, p.status, p.tax,
                 s.supplier_name, s.contact_person
          FROM purchases p
          LEFT JOIN suppliers s ON p.supplier_id = s.id
          WHERE 1=1
          ${from_date ? `AND p.purchase_date >= '${from_date}'` : ''}
          ${to_date ? `AND p.purchase_date <= '${to_date}'` : ''}
          ORDER BY p.purchase_date DESC
        `);
        data = rows;
        break;
      }

      case 'profit-and-loss': {
        const [sales] = await query(`
          SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM sales WHERE status = 'completed'
          ${from_date ? `AND sale_date >= '${from_date}'` : ''}
          ${to_date ? `AND sale_date <= '${to_date}'` : ''}
        `);
        const [cogs] = await query(`
          SELECT COALESCE(SUM(si.quantity * COALESCE(mb.purchase_price, m.purchase_price, 0)), 0) AS cogs
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          JOIN medicines m ON si.medicine_id = m.id
          LEFT JOIN medicine_batches mb ON si.batch_id = mb.id
          WHERE s.status = 'completed'
          ${from_date ? `AND s.sale_date >= '${from_date}'` : ''}
          ${to_date ? `AND s.sale_date <= '${to_date}'` : ''}
        `);
        const [expenses] = await query(`
          SELECT COALESCE(SUM(amount), 0) AS expenses FROM expenses
          ${from_date ? `WHERE expense_date >= '${from_date}'` : ''}
          ${to_date ? `${from_date ? 'AND' : 'WHERE'} expense_date <= '${to_date}'` : ''}
        `);

        const revVal = Number(sales[0].revenue) || 0;
        const cogsVal = Number(cogs[0].cogs) || 0;
        const grossVal = revVal - cogsVal;
        const expVal = Number(expenses[0].expenses) || 0;
        const netVal = grossVal - expVal;

        data = [
          { item: 'Total Sales Revenue', amount: revVal, type: 'income' },
          { item: 'Cost of Goods Sold (COGS)', amount: -cogsVal, type: 'cost' },
          { item: 'Gross Profit', amount: grossVal, type: 'profit' },
          { item: 'Operating Expenses', amount: -expVal, type: 'expense' },
          { item: 'Net Profit', amount: netVal, type: 'net' },
        ];
        break;
      }

      case 'inventory': {
        const [rows] = await query(`
          SELECT m.id, m.medicine_name, m.category, m.quantity, m.reorder_level,
                 m.purchase_price, m.selling_price, m.mrp,
                 (m.quantity * m.purchase_price) AS cost_valuation,
                 (m.quantity * m.selling_price) AS retail_valuation,
                 m.expiry_date
          FROM medicines m
          ${category ? `WHERE m.category = '${category}'` : ''}
          ORDER BY m.medicine_name ASC
        `);
        data = rows;
        break;
      }

      case 'expiry': {
        const [rows] = await query(`
          SELECT mb.id, mb.batch_number, mb.expiry_date, mb.quantity, mb.purchase_price, mb.selling_price,
                 m.medicine_name, m.category,
                 DATEDIFF(mb.expiry_date, CURDATE()) AS days_to_expiry,
                 CASE 
                   WHEN mb.expiry_date < CURDATE() THEN 'Expired'
                   WHEN mb.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Critical (<= 30d)'
                   WHEN mb.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 60 DAY) THEN 'Warning (<= 60d)'
                   ELSE 'Approaching (<= 90d)'
                 END AS status_category
          FROM medicine_batches mb
          JOIN medicines m ON mb.medicine_id = m.id
          WHERE mb.quantity > 0 AND mb.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
          ORDER BY mb.expiry_date ASC
        `);
        data = rows;
        break;
      }

      case 'low-stock': {
        const [rows] = await query(`
          SELECT id, medicine_name, category, quantity, reorder_level, purchase_price, selling_price, manufacturer
          FROM medicines
          WHERE quantity <= COALESCE(reorder_level, 10)
          ORDER BY quantity ASC
        `);
        data = rows;
        break;
      }

      case 'supplier-performance': {
        const [rows] = await query(`
          SELECT s.id, s.supplier_name, s.contact_person, s.phone, s.email,
                 COUNT(p.id) AS total_orders,
                 COALESCE(SUM(p.total_amount), 0) AS total_order_value,
                 COALESCE(SUM(CASE WHEN p.status = 'received' THEN p.total_amount ELSE 0 END), 0) AS received_value,
                 COALESCE(SUM(CASE WHEN p.status IN ('ordered', 'pending_approval') THEN p.total_amount ELSE 0 END), 0) AS pending_value
          FROM suppliers s
          LEFT JOIN purchases p ON s.id = p.supplier_id
          GROUP BY s.id, s.supplier_name, s.contact_person, s.phone, s.email
          ORDER BY total_order_value DESC
        `);
        data = rows;
        break;
      }

      case 'customer-purchases': {
        const [rows] = await query(`
          SELECT c.id, c.customer_name, c.email, c.phone,
                 COUNT(s.id) AS total_orders,
                 COALESCE(SUM(s.total_amount), 0) AS total_spent,
                 MAX(s.sale_date) AS last_purchase_date
          FROM customers c
          JOIN sales s ON c.id = s.customer_id
          WHERE s.status = 'completed'
          GROUP BY c.id, c.customer_name, c.email, c.phone
          ORDER BY total_spent DESC
          LIMIT 100
        `);
        data = rows;
        break;
      }

      case 'pharmacist-activity': {
        const [rows] = await query(`
          SELECT u.id, u.name, u.email, u.employee_id,
                 (SELECT COUNT(*) FROM prescriptions WHERE verified_by = u.id) AS prescriptions_reviewed,
                 (SELECT COUNT(*) FROM prescriptions WHERE dispensed_by = u.id) AS prescriptions_dispensed,
                 (SELECT COUNT(*) FROM sales WHERE pharmacist_id = u.id) AS bills_issued,
                 (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE pharmacist_id = u.id) AS total_dispensed_revenue
          FROM users u
          WHERE u.role IN ('pharmacist', 'admin')
          ORDER BY bills_issued DESC
        `);
        data = rows;
        break;
      }

      case 'expenses': {
        const [rows] = await query(`
          SELECT id, expense_title, category, amount, expense_date, description
          FROM expenses
          WHERE 1=1
          ${from_date ? `AND expense_date >= '${from_date}'` : ''}
          ${to_date ? `AND expense_date <= '${to_date}'` : ''}
          ORDER BY expense_date DESC
        `);
        data = rows;
        break;
      }

      case 'returns': {
        const [rows] = await query(`
          SELECT r.id, r.sale_id, r.quantity, r.return_reason, r.refund_amount,
                 r.inspection_status, r.inspection_notes, r.return_date,
                 m.medicine_name, c.customer_name
          FROM returns r
          JOIN medicines m ON r.medicine_id = m.id
          LEFT JOIN customers c ON r.customer_id = c.id
          ORDER BY r.return_date DESC
        `);
        data = rows;
        break;
      }

      default:
        throw ApiError.badRequest(`Unknown report type: ${reportType}`);
    }

    return ApiResponse.success(res, { reportType, records: data, summary }, 'Report generated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================================
 * SYSTEM SETTINGS MODULE
 * ============================================================================
 */

/**
 * Get all system settings
 * @route GET /api/v1/admin/settings
 */
const getSystemSettings = async (req, res, next) => {
  try {
    const [settings] = await query('SELECT setting_key, setting_value, category, description, updated_at FROM system_settings ORDER BY id ASC');
    const settingsMap = {};
    settings.forEach((s) => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    return ApiResponse.success(res, { list: settings, map: settingsMap }, 'System settings retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * Update system settings
 * @route PUT /api/v1/admin/settings
 */
const updateSystemSettings = async (req, res, next) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      throw ApiError.badRequest('Valid settings key-value object required');
    }

    await transaction(async (conn) => {
      for (const [key, value] of Object.entries(settings)) {
        await conn.execute(
          `INSERT INTO system_settings (setting_key, setting_value, category)
           VALUES (?, ?, 'general')
           ON DUPLICATE KEY UPDATE setting_value = ?`,
          [key, String(value), String(value)]
        );
      }

      await logAudit(req.user.id, 'SYSTEM_SETTINGS_UPDATED', 'system_settings', null, {
        updatedKeys: Object.keys(settings),
      }, conn);
    });

    const [updatedList] = await query('SELECT setting_key, setting_value, category, description, updated_at FROM system_settings');
    const map = {};
    updatedList.forEach((s) => {
      map[s.setting_key] = s.setting_value;
    });

    return ApiResponse.success(res, { list: updatedList, map }, 'System settings updated successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminDashboardTelemetry,
  getAllEmployees,
  createEmployee,
  updateEmployee,
  resetEmployeePassword,
  getAllUsers,
  toggleUserStatus,
  getPrescriptionOversight,
  cancelSale,
  getFinancialSummary,
  getReportData,
  getSystemSettings,
  updateSystemSettings,
};
