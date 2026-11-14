const express = require('express');
const {
  getStockMovements,
  getInventorySummary,
  getAllBatches,
  adjustStock,
} = require('../controllers/inventory.controller');
const { blockBatch, unblockBatch } = require('../controllers/pharmacist.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, authorize('admin', 'pharmacist'));

router.get('/movements', getStockMovements);
router.get('/summary', getInventorySummary);
router.get('/batches', getAllBatches);
router.post('/batches/:id/block', blockBatch);
router.post('/batches/:id/unblock', unblockBatch);
router.post('/adjust', adjustStock);

module.exports = router;
