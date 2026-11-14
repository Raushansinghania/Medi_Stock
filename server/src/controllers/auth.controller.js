const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

const signToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'medistock_jwt_super_secret_dev_key_change_in_production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Register a new user
 * @route POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      throw ApiError.badRequest('Name, email, and password are required');
    }

    if (password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters long');
    }

    // Role check: Only admin can register other roles or pharmacists; default is 'customer'
    let assignedRole = 'customer';
    if (role && ['admin', 'pharmacist', 'customer'].includes(role)) {
      // If user registering is admin, allow assigning role, or if no users exist in database yet (first user is admin)
      const [userCount] = await query('SELECT COUNT(*) AS count FROM users');
      if (userCount[0].count === 0) {
        assignedRole = 'admin'; // First registered user is automatically admin
      } else if (req.user && req.user.role === 'admin') {
        assignedRole = role;
      } else if (role === 'customer' || role === 'pharmacist') {
        assignedRole = role;
      }
    }

    // Check if email already exists
    const [existing] = await query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      throw ApiError.conflict(`An account with email '${email}' already exists`);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user into MySQL
    const [result] = await query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hashedPassword, assignedRole]
    );

    const newUserId = result.insertId;

    // If role is customer, also link/create record in customers table
    if (assignedRole === 'customer') {
      const [existingCust] = await query('SELECT id FROM customers WHERE email = ?', [email.toLowerCase().trim()]);
      if (existingCust.length > 0) {
        await query('UPDATE customers SET user_id = ? WHERE id = ?', [newUserId, existingCust[0].id]);
      } else {
        await query(
          'INSERT INTO customers (user_id, customer_name, email, phone, address) VALUES (?, ?, ?, ?, ?)',
          [newUserId, name.trim(), email.toLowerCase().trim(), req.body.phone || null, req.body.address || null]
        );
      }
    }

    const token = signToken(newUserId);

    res.cookie('medistock_token', token, cookieOptions);

    await logAudit(newUserId, 'USER_REGISTERED', 'users', newUserId, { name, email, role: assignedRole });

    return ApiResponse.created(
      res,
      {
        user: {
          id: newUserId,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          role: assignedRole,
        },
        token,
      },
      'User registered successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * User login
 * @route POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required');
    }

    const [rows] = await query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (rows.length === 0) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const token = signToken(user.id);
    res.cookie('medistock_token', token, cookieOptions);

    await logAudit(user.id, 'USER_LOGIN', 'users', user.id, { email: user.email });

    return ApiResponse.success(
      res,
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user
 * @route GET /api/v1/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    return ApiResponse.success(res, { user: req.user }, 'Profile fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update authenticated user profile
 * @route PUT /api/v1/auth/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const userId = req.user.id;

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (email) {
      const emailTrimmed = email.toLowerCase().trim();
      const [check] = await query('SELECT id FROM users WHERE email = ? AND id != ?', [emailTrimmed, userId]);
      if (check.length > 0) {
        throw ApiError.conflict('Email is already in use by another account');
      }
      updates.push('email = ?');
      params.push(emailTrimmed);
    }

    if (password) {
      if (password.length < 6) {
        throw ApiError.badRequest('Password must be at least 6 characters');
      }
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      updates.push('password = ?');
      params.push(hash);
    }

    if (updates.length === 0) {
      throw ApiError.badRequest('No profile updates provided');
    }

    params.push(userId);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await query('SELECT id, name, email, role FROM users WHERE id = ?', [userId]);

    await logAudit(userId, 'USER_UPDATE_PROFILE', 'users', userId);

    return ApiResponse.success(res, { user: updated[0] }, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users (Admin only)
 * @route GET /api/v1/auth/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const [users] = await query('SELECT id, name, email, role FROM users ORDER BY id ASC');
    return ApiResponse.success(res, users, 'Users retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update user role (Admin only)
 * @route PATCH /api/v1/auth/users/:id/role
 */
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'pharmacist', 'customer'].includes(role)) {
      throw ApiError.badRequest("Invalid role. Must be 'admin', 'pharmacist', or 'customer'");
    }

    const [existing] = await query('SELECT id, name, email, role FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('User not found');
    }

    await query('UPDATE users SET role = ? WHERE id = ?', [role, id]);

    await logAudit(req.user.id, 'USER_ROLE_CHANGED', 'users', id, {
      previousRole: existing[0].role,
      newRole: role,
    });

    return ApiResponse.success(
      res,
      { id: Number(id), role },
      `User role updated to ${role}`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Logout
 * @route POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    res.clearCookie('medistock_token');
    return ApiResponse.success(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  getAllUsers,
  updateUserRole,
  logout,
};
