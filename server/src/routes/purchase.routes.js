const express = require('express');
const {
  getAllPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchaseStatus,
  receivePurchaseGoods,
} = require('../controllers/purchase.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('admin', 'pharmacist'), getAllPurchases);
router.get('/:id', authorize('admin', 'pharmacist'), getPurchaseById);
router.post('/', authorize('admin', 'pharmacist'), createPurchase);
router.patch('/:id/status', authorize('admin'), updatePurchaseStatus);
router.post('/:id/receive', authorize('admin', 'pharmacist'), receivePurchaseGoods);

module.exports = router;
