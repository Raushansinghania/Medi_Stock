const { query } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');

/**
 * Get audit logs (Admin only)
 * @route GET /api/v1/audit-logs
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, entity_type, user_id, from_date, to_date, page = 1, limit = 50 } = req.query;

    let sql = `
      SELECT al.*, u.name AS user_name, u.email AS user_email, u.role AS user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    const conditions = [];
    const params = [];

    if (action) {
      conditions.push('al.action LIKE ?');
      params.push(`%${action}%`);
    }
    if (entity_type) {
      conditions.push('al.entity_type = ?');
      params.push(entity_type);
    }
    if (user_id) {
      conditions.push('al.user_id = ?');
      params.push(user_id);
    }
    if (from_date) {
      conditions.push('al.created_at >= ?');
      params.push(from_date);
    }
    if (to_date) {
      conditions.push('al.created_at <= ?');
      params.push(to_date);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Count
    const [countRows] = await query(
      `SELECT COUNT(*) AS total FROM audit_logs al ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}`,
      params
    );
    const totalDocs = countRows[0].total;

    sql += ' ORDER BY al.id DESC LIMIT ? OFFSET ?';
    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await query(sql, [...params, Number(limit), Number(offset)]);

    return ApiResponse.paginated(
      res,
      rows,
      { page: Number(page), limit: Number(limit), totalDocs },
      'Audit logs retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
};
