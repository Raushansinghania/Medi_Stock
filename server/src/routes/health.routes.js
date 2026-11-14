const express = require('express');
const { getDBStatus } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');

const router = express.Router();

/**
 * @route GET /api/v1/health
 * @desc System health check, uptime, memory, and MySQL database connection state
 * @access Public
 */
router.get('/', async (req, res, next) => {
  try {
    const dbStatus = await getDBStatus();

    const isHealthy = dbStatus.status === 'connected';
    const healthData = {
      service: 'MediStock API Server',
      version: '1.0.0',
      status: isHealthy ? 'healthy' : 'degraded',
      tableCount: dbStatus.tableCount || 0,
      database: dbStatus,
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      memoryUsage: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      },
    };

    const statusCode = isHealthy ? 200 : 503;
    const statusMessage = isHealthy ? 'System operational' : 'Database unmigrated or unavailable';
    return ApiResponse.success(res, healthData, statusMessage, statusCode);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
