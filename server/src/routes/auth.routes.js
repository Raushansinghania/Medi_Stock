const express = require('express');
const {
  register,
  login,
  getMe,
  updateProfile,
  getAllUsers,
  updateUserRole,
  logout,
} = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Authenticated routes
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);

// Admin-only routes
router.get('/users', authenticate, authorize('admin'), getAllUsers);
router.patch('/users/:id/role', authenticate, authorize('admin'), updateUserRole);

module.exports = router;
