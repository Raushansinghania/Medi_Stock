const express = require('express');
const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/category.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', getAllCategories);
router.get('/:id', getCategoryById);

// Protected routes (Admin & Pharmacist)
router.post('/', authenticate, authorize('admin', 'pharmacist'), createCategory);
router.put('/:id', authenticate, authorize('admin', 'pharmacist'), updateCategory);
router.delete('/:id', authenticate, authorize('admin'), deleteCategory);

module.exports = router;
