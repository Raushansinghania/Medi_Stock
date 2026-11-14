const express = require('express');
const {
  getAllOrders,
  getOrderById,
  createOrder,
  cancelOrder,
  updateOrderStatus,
} = require('../controllers/order.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', getAllOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);

// Allow both PUT and PATCH for order cancellation
router.put('/:id/cancel', cancelOrder);
router.patch('/:id/cancel', cancelOrder);

// Allow both PUT and PATCH for status updates (Admin/Pharmacist)
router.put('/:id/status', authorize('admin', 'pharmacist'), updateOrderStatus);
router.patch('/:id/status', authorize('admin', 'pharmacist'), updateOrderStatus);

module.exports = router;
