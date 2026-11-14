const express = require('express');
const {
  getAllMedicines,
  getSearchSuggestions,
  getMedicineById,
  createMedicine,
  updateMedicine,
  adjustStock,
  deleteMedicine,
} = require('../controllers/medicine.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Search suggestions (must be before :id)
router.get('/suggestions', getSearchSuggestions);

// Public / Authenticated read routes
router.get('/', getAllMedicines);
router.get('/:id', getMedicineById);

// Staff routes (Admin & Pharmacist)
router.post('/', authenticate, authorize('admin', 'pharmacist'), createMedicine);
router.put('/:id', authenticate, authorize('admin', 'pharmacist'), updateMedicine);
router.post('/:id/adjust-stock', authenticate, authorize('admin', 'pharmacist'), adjustStock);

// Admin-only deletion
router.delete('/:id', authenticate, authorize('admin'), deleteMedicine);

module.exports = router;
