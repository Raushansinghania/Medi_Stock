const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * Centralized Global Error Handler Middleware
 * Handles MySQL error codes, JWT errors, validation errors, and custom ApiErrors
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle MySQL Duplicate Entry Error (Code 1062 / ER_DUP_ENTRY)
  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    const match = err.sqlMessage?.match(/Duplicate entry '(.*)' for key '?(.*?)'?$/);
    const value = match ? match[1] : 'Value';
    const key = match ? match[2] : 'field';
    const message = `Duplicate entry '${value}' for ${key}. This record already exists.`;
    error = ApiError.conflict(message);
  }

  // Handle MySQL Foreign Key Constraint Failures (Code 1452 / ER_NO_REFERENCED_ROW_2)
  else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) {
    const message = 'Referenced entity not found. Please check referenced IDs.';
    error = ApiError.badRequest(message);
  }

  // Handle MySQL Foreign Key Delete/Update Blocked (Code 1451 / ER_ROW_IS_REFERENCED_2)
  else if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
    const message = 'Cannot delete or modify record because other records depend on it.';
    error = ApiError.badRequest(message);
  }

  // Handle MySQL Bad Null Value (Code 1048 / ER_BAD_NULL_ERROR)
  else if (err.code === 'ER_BAD_NULL_ERROR' || err.errno === 1048) {
    const match = err.sqlMessage?.match(/Column '(.*)' cannot be null/);
    const col = match ? match[1] : 'Field';
    const message = `${col} is required and cannot be null.`;
    error = ApiError.badRequest(message);
  }

  // Handle MySQL Data Too Long (Code 1406 / ER_DATA_TOO_LONG)
  else if (err.code === 'ER_DATA_TOO_LONG' || err.errno === 1406) {
    const match = err.sqlMessage?.match(/Data too long for column '(.*)'/);
    const col = match ? match[1] : 'Field';
    const message = `Data too long for column '${col}'.`;
    error = ApiError.badRequest(message);
  }

  // Handle MySQL Truncated/Invalid value (Code 1292 / ER_TRUNCATED_WRONG_VALUE)
  else if (err.code === 'ER_TRUNCATED_WRONG_VALUE' || err.errno === 1292) {
    error = ApiError.badRequest(`Invalid data format: ${err.sqlMessage || 'Incorrect value'}`);
  }

  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid authentication token');
  } else if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Authentication token has expired');
  }

  // Default to 500 if not an ApiError instance
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const errors = error.errors || [];

  if (statusCode >= 500) {
    logger.error(`[Unhandled Exception] ${req.method} ${req.originalUrl}:`, err);
  } else {
    logger.warn(`[Client Error] ${req.method} ${req.originalUrl} (${statusCode}): ${message}`);
  }

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
