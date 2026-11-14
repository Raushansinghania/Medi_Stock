const { query } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');

/**
 * Get aggregated dashboard statistics and operational KPIs
 * @route GET /api/v1/dashboard/stats
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const [counts] = await query(`
      SELECT
        (SELECT COUNT(*) FROM medicines) AS total_medicines,
        (SELECT COUNT(*) FROM medicines WHERE quantity <= 10) AS low_stock_medicines,
        (SELECT COUNT(*) FROM customers) AS total_customers,
        (SELECT COUNT(*) FROM suppliers) AS total_suppliers,
        (SELECT COUNT(*) FROM sales) AS total_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM sales) AS total_revenue,
        (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE sale_date = CURDATE()) AS today_revenue,
        (SELECT COALESCE(SUM(total_amount), 0) FROM purchases) AS total_purchases,
        (SELECT COALESCE(SUM(amount), 0) FROM expenses) AS total_expenses,
        (SELECT COUNT(*) FROM prescriptions WHERE status = 'pending') AS pending_prescriptions
    `);

    // Recent 5 sales
    const [recentSales] = await query(`
      SELECT s.id, s.invoice_number, s.sale_date, s.total_amount, s.payment_method, c.customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.id DESC
      LIMIT 5
    `);

    // Top 5 low stock medicines
    const [lowStockList] = await query(`
      SELECT id, medicine_name, category, quantity, batch_number, expiry_date
      FROM medicines
      WHERE quantity <= 10
      ORDER BY quantity ASC
      LIMIT 5
    `);

    // Recent 5 stock movements
    const [recentMovements] = await query(`
      SELECT sm.*, m.medicine_name
      FROM stock_movements sm
      JOIN medicines m ON sm.medicine_id = m.id
      ORDER BY sm.id DESC
      LIMIT 5
    `);

    return ApiResponse.success(
      res,
      {
        kpis: counts[0],
        recentSales,
        lowStockList,
        recentMovements,
      },
      'Dashboard stats retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
};
