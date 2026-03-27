import logger from '../utils/logger.js';

// Global error handler middleware
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      statusCode: 400,
      message: 'Validation Error',
      errors: Object.values(err.errors).map(val => ({
        field: val.path,
        message: val.message
      }))
    };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    error = {
      statusCode: 400,
      message: `${field} already exists`,
      field,
      value
    };
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    error = {
      statusCode: 400,
      message: 'Resource not found',
      field: err.path
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      statusCode: 401,
      message: 'Invalid token'
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      statusCode: 401,
      message: 'Token expired'
    };
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      statusCode: 400,
      message: 'File size too large'
    };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    error = {
      statusCode: 400,
      message: 'Too many files uploaded'
    };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = {
      statusCode: 400,
      message: 'Unexpected file field'
    };
  }

  // Joi validation errors
  if (err.isJoi) {
    error = {
      statusCode: 400,
      message: 'Validation Error',
      errors: err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    };
  }

  // Stripe errors
  if (err.type === 'StripeCardError') {
    error = {
      statusCode: 400,
      message: 'Your card was declined.',
      code: err.code
    };
  }

  if (err.type === 'StripeRateLimitError') {
    error = {
      statusCode: 429,
      message: 'Too many requests made to the Stripe API too quickly.'
    };
  }

  if (err.type === 'StripeInvalidRequestError') {
    error = {
      statusCode: 400,
      message: 'Invalid parameters supplied to Stripe API.',
      code: err.code
    };
  }

  if (err.type === 'StripeAPIError') {
    error = {
      statusCode: 500,
      message: 'Stripe API error occurred.',
      code: err.code
    };
  }

  if (err.type === 'StripeConnectionError') {
    error = {
      statusCode: 500,
      message: 'Could not connect to Stripe.'
    };
  }

  if (err.type === 'StripeAuthenticationError') {
    error = {
      statusCode: 401,
      message: 'Authentication with Stripe API failed.'
    };
  }

  // Cloudinary errors
  if (err.name === 'CloudinaryError') {
    error = {
      statusCode: 400,
      message: 'Cloud service error occurred.',
      details: err.message
    };
  }

  // Network errors
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    error = {
      statusCode: 503,
      message: 'Service unavailable. Please try again later.'
    };
  }

  // Syntax errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = {
      statusCode: 400,
      message: 'Invalid JSON in request body'
    };
  }

  // Default error
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || 'Internal server error';

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(isDevelopment && { 
      stack: err.stack,
      error: error 
    }),
    ...(error.errors && { errors: error.errors }),
    ...(error.field && { field: error.field }),
    ...(error.value && { value: error.value }),
    ...(error.code && { code: error.code })
  });
};

// 404 handler
export const notFoundHandler = (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.url}`);
  
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`
  });
};

// Async error wrapper
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Custom error classes
export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable') {
    super(message, 503);
  }
}

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError
};
