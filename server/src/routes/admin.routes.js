const express = require('express');
const {
  getAdminDashboardTelemetry,
  getAllEmployees,
  createEmployee,
  updateEmployee,
  resetEmployeePassword,
  getAllUsers,
  toggleUserStatus,
  getPrescriptionOversight,
  cancelSale,
  getFinancialSummary,
  getReportData,
  getSystemSettings,
  updateSystemSettings,
} = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Strict RBAC: All /api/v1/admin/* endpoints require authenticated administrator
router.use(authenticate, authorize('admin'));

// 1. Dashboard Central Command
router.get('/dashboard', getAdminDashboardTelemetry);

// 2. Employee Management
router.get('/employees', getAllEmployees);
router.post('/employees', createEmployee);
router.put('/employees/:id', updateEmployee);
router.post('/employees/:id/reset-password', resetEmployeePassword);

// 3. User Management
router.get('/users', getAllUsers);
router.patch('/users/:id/status', toggleUserStatus);

// 4. Prescription Oversight
router.get('/prescriptions/overview', getPrescriptionOversight);

// 5. Sales & Invoices Oversight
router.post('/sales/:id/cancel', cancelSale);

// 6. Financial Analytics
router.get('/finance/summary', getFinancialSummary);

// 7. 12 Reports & Analytics
router.get('/reports/:reportType', getReportData);

// 8. System Settings
router.get('/settings', getSystemSettings);
router.put('/settings', updateSystemSettings);

module.exports = router;
