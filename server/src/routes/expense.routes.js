const express = require('express');
const {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
} = require('../controllers/expense.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Operating expenses and confidential financial administration are ADMIN ONLY
router.get('/', authorize('admin'), getAllExpenses);
router.get('/:id', authorize('admin'), getExpenseById);
router.post('/', authorize('admin'), createExpense);
router.put('/:id', authorize('admin'), updateExpense);
router.delete('/:id', authorize('admin'), deleteExpense);

module.exports = router;
