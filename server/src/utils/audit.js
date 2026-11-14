const { query } = require('../config/db');
const logger = require('./logger');

/**
 * Record an action in the audit_logs table
 * @param {number|null} userId 
 * @param {string} action 
 * @param {string} entityType 
 * @param {number|null} entityId 
 * @param {string|object} details 
 * @param {import('mysql2/promise').PoolConnection} [connection] Optional transaction connection
 */
const logAudit = async (userId, action, entityType = null, entityId = null, details = null, connection = null) => {
  try {
    const detailsStr = typeof details === 'object' && details !== null ? JSON.stringify(details) : details;
    const sql = `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?)
    `;
    const params = [userId || null, action, entityType, entityId, detailsStr];

    if (connection) {
      await connection.execute(sql, params);
    } else {
      await query(sql, params);
    }
  } catch (error) {
    // Non-blocking error for audit logs so the main transaction is not aborted if audit table issue
    logger.warn('Failed to record audit log:', error.message);
  }
};

module.exports = { logAudit };
