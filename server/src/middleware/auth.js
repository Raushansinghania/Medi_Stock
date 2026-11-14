const jwt = require('jsonwebtoken');
const ApiError = require('../utils/apiError');
const { query } = require('../config/db');

/**
 * Authentication middleware to verify JWT token from Authorization header or cookie
 */
const authenticate = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.medistock_token) {
      token = req.cookies.medistock_token;
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return next(ApiError.unauthorized('Authentication token is required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'medistock_jwt_super_secret_dev_key_change_in_production');

    // Fetch user from MySQL database
    const [rows] = await query('SELECT id, name, email, role FROM users WHERE id = ?', [decoded.id]);

    if (!rows || rows.length === 0) {
      return next(ApiError.unauthorized('User associated with this token no longer exists'));
    }

    req.user = rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(ApiError.unauthorized('Invalid authentication token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Authentication token has expired. Please log in again.'));
    }
    next(error);
  }
};

/**
 * Role-Based Access Control (RBAC) middleware
 * @param  {...string} roles Allowed roles ('admin', 'pharmacist', 'customer')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Forbidden: Role '${req.user.role}' does not have permission to perform this action. Required: [${roles.join(', ')}]`
        )
      );
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
};
