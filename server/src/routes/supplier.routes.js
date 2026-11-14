const express = require('express');
const {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} = require('../controllers/supplier.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Pharmacists can view supplier info, but ONLY admin can manage (create/update/delete) suppliers
router.get('/', authorize('admin', 'pharmacist'), getAllSuppliers);
router.get('/:id', authorize('admin', 'pharmacist'), getSupplierById);

router.post('/', authorize('admin'), createSupplier);
router.put('/:id', authorize('admin'), updateSupplier);
router.delete('/:id', authorize('admin'), deleteSupplier);

module.exports = router;
