const express = require('express');
const {
  getAllReturns,
  getReturnById,
  processReturn,
} = require('../controllers/return.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'pharmacist'), getAllReturns);
router.get('/:id', authenticate, authorize('admin', 'pharmacist'), getReturnById);
router.post('/', authenticate, authorize('admin', 'pharmacist'), processReturn);

module.exports = router;
