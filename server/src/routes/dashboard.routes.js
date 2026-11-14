const express = require('express');
const { getDashboardStats } = require('../controllers/dashboard.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Only staff (admin & pharmacist) can access executive store-wide telemetry
router.get('/stats', authenticate, authorize('admin', 'pharmacist'), getDashboardStats);

module.exports = router;
