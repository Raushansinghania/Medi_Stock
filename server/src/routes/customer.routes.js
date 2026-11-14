const express = require('express');
const {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerDashboard,
  getCustomerProfile,
  updateCustomerProfile,
  changeCustomerPassword,
} = require('../controllers/customer.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Dedicated Customer Self-Service Routes (must be defined before /:id)
router.get('/me/dashboard', getCustomerDashboard);
router.get('/me/profile', getCustomerProfile);
router.put('/me/profile', updateCustomerProfile);
router.put('/me/change-password', changeCustomerPassword);

// General Customer Directory (Staff & Admin)
router.get('/', getAllCustomers);
router.get('/:id', getCustomerById);
router.post('/', authorize('admin', 'pharmacist'), createCustomer);
router.put('/:id', authorize('admin', 'pharmacist'), updateCustomer);
router.delete('/:id', authorize('admin'), deleteCustomer);

module.exports = router;
