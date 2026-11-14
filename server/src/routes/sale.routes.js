const express = require('express');
const {
  getAllSales,
  getSaleById,
  createSale,
} = require('../controllers/sale.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Authenticated: admin and pharmacist can view all, customer views own
router.get('/', authenticate, getAllSales);
router.get('/:id', authenticate, getSaleById);

// Creation allowed for admin and pharmacist
router.post('/', authenticate, authorize('admin', 'pharmacist'), createSale);

module.exports = router;
