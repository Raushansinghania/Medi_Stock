const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config(); // Fallback for local CWD override
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

let pool = null;
let isConnected = false;

/**
 * Mask credentials in database host/user info for safe logging
 */
const getDbConfig = () => {
  if (process.env.MYSQL_URL || process.env.DATABASE_URL) {
    try {
      const dbUrl = new URL(process.env.MYSQL_URL || process.env.DATABASE_URL);
      return {
        host: dbUrl.hostname || '127.0.0.1',
        port: Number(dbUrl.port) || 3306,
        user: decodeURIComponent(dbUrl.username || 'medistock_app'),
        password: decodeURIComponent(dbUrl.password || ''),
        database: dbUrl.pathname ? dbUrl.pathname.replace(/^\//, '') : 'medistock',
      };
    } catch {
      // Fallback if URL parsing fails
    }
  }

  return {
    host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || 'medistock_app',
    password: process.env.DB_PASSWORD !== undefined
      ? process.env.DB_PASSWORD
      : (process.env.MYSQLPASSWORD !== undefined ? process.env.MYSQLPASSWORD : ''),
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'medistock',
  };
};

const getSafeDbDetails = () => {
  const { host, port, user, database } = getDbConfig();
  return { host, port, user, database };
};

/**
 * Initialize and test the MySQL connection pool
 * Never silently falls back to an in-memory database
 */
const connectDB = async () => {
  const { host, port, user, password, database } = getDbConfig();

  if (password === undefined || password === null) {
    const errorMsg = 'Database password is missing. MySQL connection requires valid credentials.';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    logger.info(`Connecting to MySQL database at ${host}:${port} as '${user}'...`);

    const sslConfig = process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined;

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
      queueLimit: Number(process.env.DB_QUEUE_LIMIT) || 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      namedPlaceholders: true,
      decimalNumbers: true,
      ...(sslConfig ? { ssl: sslConfig } : {}),
    });

    // Test the pool by acquiring and releasing a connection
    const connection = await pool.getConnection();
    await connection.ping();
    const [rows] = await connection.query('SELECT 1 + 1 AS result, VERSION() AS version');
    connection.release();

    isConnected = true;
    const version = rows?.[0]?.version || '8.0';
    logger.success(`MySQL Connected Successfully! Host: ${host}:${port} | Database: ${database} | Engine: MySQL ${version}`);
    return pool;
  } catch (error) {
    isConnected = false;
    logger.error(`Failed to connect to MySQL database at ${host}:${port}: ${error.message}`);
    logger.error('Troubleshooting MySQL connection:');
    logger.error('  1. Ensure MySQL service is running on the specified host & port.');
    logger.error('  2. Verify DB_USER and DB_PASSWORD in server/.env.');
    logger.error(`  3. Ensure database '${database}' exists and '${user}' has granted privileges.`);
    throw new Error(`MySQL database connection failed: ${error.message}`);
  }
};

/**
 * Returns the active MySQL connection pool
 */
const getPool = () => {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call connectDB() first.');
  }
  return pool;
};

/**
 * Helper to execute a query using pool.execute (prepared statement)
 * @param {string} sql 
 * @param {Array|Object} params 
 * @returns {Promise<[any, any]>}
 */
const query = async (sql, params = []) => {
  const p = getPool();
  return p.execute(sql, params);
};

/**
 * Helper to run operations within a managed database transaction
 * Automatically rolls back on error and releases the connection
 * @param {Function} callback - async (connection) => Promise<any>
 */
const transaction = async (callback) => {
  const p = getPool();
  const connection = await p.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Cleanly close the connection pool on application shutdown
 */
const disconnectDB = async () => {
  try {
    if (pool) {
      await pool.end();
      pool = null;
      isConnected = false;
      logger.info('MySQL connection pool closed cleanly.');
    }
  } catch (error) {
    logger.error('Error closing MySQL connection pool:', error.message);
  }
};

/**
 * Health check telemetry status helper
 */
const getDBStatus = async () => {
  const { host, port, user, database } = getSafeDbDetails();
  if (!pool || !isConnected) {
    return {
      status: 'disconnected',
      engine: 'MySQL 8.0',
      host,
      port,
      database,
    };
  }

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT VERSION() AS version');
    connection.release();
    return {
      status: 'connected',
      engine: `MySQL ${rows?.[0]?.version || '8.0'}`,
      host,
      port,
      user,
      database,
    };
  } catch (error) {
    return {
      status: 'degraded',
      error: error.message,
      engine: 'MySQL 8.0',
      host,
      port,
      database,
    };
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  getPool,
  query,
  transaction,
  getDBStatus,
  getSafeDbDetails,
};
