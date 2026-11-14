const express = require('express');
const {
  getAllPayments,
  getPaymentById,
  createPayment,
} = require('../controllers/payment.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Customers can view their own payments; staff can view all payments
router.get('/', getAllPayments);
router.get('/:id', getPaymentById);
router.post('/', authorize('admin', 'pharmacist'), createPayment);

module.exports = router;
