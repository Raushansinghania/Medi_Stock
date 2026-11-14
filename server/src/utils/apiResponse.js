/**
 * Standardized API Response formatter
 */
class ApiResponse {
  constructor(statusCode, data, message = 'Success', meta = null) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    if (meta) {
      this.meta = meta;
    }
  }

  static success(res, data = null, message = 'Success', statusCode = 200, meta = null) {
    return res.status(statusCode).json(new ApiResponse(statusCode, data, message, meta));
  }

  static created(res, data = null, message = 'Resource created successfully', meta = null) {
    return res.status(201).json(new ApiResponse(201, data, message, meta));
  }

  static paginated(res, data, pagination, message = 'Success') {
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        totalDocs: pagination.totalDocs,
        totalPages: Math.ceil(pagination.totalDocs / pagination.limit),
        hasNextPage: pagination.page * pagination.limit < pagination.totalDocs,
        hasPrevPage: pagination.page > 1,
      },
    });
  }
}

module.exports = ApiResponse;
