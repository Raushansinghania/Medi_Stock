const express = require('express');
const {
  upload,
  getAllPrescriptions,
  getPrescriptionById,
  uploadPrescription,
  getPrescriptionFile,
  createPrescription,
  updatePrescriptionStatus,
  deletePrescription,
} = require('../controllers/prescription.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', getAllPrescriptions);
router.get('/:id', getPrescriptionById);
router.get('/:id/file', getPrescriptionFile);

// File upload endpoint for customers
router.post('/upload', upload.single('prescription_file'), uploadPrescription);

// JSON creation endpoint
router.post('/', createPrescription);

// Pharmacist & Admin can approve/reject (support both PATCH and PUT)
router.patch('/:id/status', authorize('admin', 'pharmacist'), updatePrescriptionStatus);
router.put('/:id/status', authorize('admin', 'pharmacist'), updatePrescriptionStatus);

// Admin deletion
router.delete('/:id', authorize('admin'), deletePrescription);

module.exports = router;
