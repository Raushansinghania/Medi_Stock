const express = require('express');
const {
  getPharmacistDashboard,
  calculateFEFO,
  getExpiryMonitoring,
  blockBatch,
  unblockBatch,
  inspectReturn,
  getDispensingActivity,
} = require('../controllers/pharmacist.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Require authentication and role: pharmacist or admin
router.use(authenticate);
router.use(authorize('pharmacist', 'admin'));

router.get('/dashboard', getPharmacistDashboard);
router.get('/fefo/calculate', calculateFEFO);
router.get('/expiry-monitoring', getExpiryMonitoring);
router.post('/batches/:id/block', blockBatch);
router.post('/batches/:id/unblock', unblockBatch);
router.post('/returns/:id/inspect', inspectReturn);
router.get('/dispensing-activity', getDispensingActivity);

module.exports = router;
