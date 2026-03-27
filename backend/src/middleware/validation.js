import Joi from 'joi';
import logger from '../utils/logger.js';

// Generic validation middleware
export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      logger.warn(`Validation error: ${errorMessage}`);
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req[property] = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  // User registration
  register: Joi.object({
    firstName: Joi.string().trim().min(2).max(50).required(),
    lastName: Joi.string().trim().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),
    role: Joi.string().valid('investor', 'entrepreneur').required(),
    bio: Joi.string().max(1000).optional().allow(''),
    interests: Joi.array().items(Joi.string().trim()).optional()
  }),

  // User login
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // Refresh token
  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  }),

  // Email verification
  emailVerification: Joi.object({
    token: Joi.string().required()
  }),

  // Password reset request
  passwordResetRequest: Joi.object({
    email: Joi.string().email().required()
  }),

  // Password reset
  passwordReset: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    })
  }),

  // Change password
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    })
  }),

  // Update profile
  updateProfile: Joi.object({
    firstName: Joi.string().trim().min(2).max(50).optional(),
    lastName: Joi.string().trim().min(2).max(50).optional(),
    bio: Joi.string().max(1000).optional().allow(''),
    interests: Joi.array().items(Joi.string().trim()).optional(),
    investmentRange: Joi.object({
      min: Joi.number().min(0).optional(),
      max: Joi.number().min(0).optional(),
      currency: Joi.string().optional()
    }).optional(),
    startup: Joi.object({
      name: Joi.string().trim().max(100).optional().allow(''),
      description: Joi.string().max(500).optional().allow(''),
      industry: Joi.string().trim().max(50).optional().allow(''),
      stage: Joi.string().valid('idea', 'seed', 'early', 'growth', 'mature').optional(),
      fundingNeeded: Joi.number().min(0).optional()
    }).optional()
  }),

  // Meeting creation
  createMeeting: Joi.object({
    title: Joi.string().trim().min(3).max(200).required(),
    description: Joi.string().max(1000).optional().allow(''),
    participants: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).min(1).required(),
    startTime: Joi.date().iso().greater('now').required(),
    endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
    timezone: Joi.string().optional(),
    meetingType: Joi.string().valid('video', 'audio', 'in_person').optional(),
    location: Joi.string().max(200).optional().allow(''),
    agenda: Joi.array().items(Joi.object({
      item: Joi.string().trim().required(),
      duration: Joi.number().min(1).required()
    })).optional(),
    isRecurring: Joi.boolean().optional(),
    recurringPattern: Joi.object({
      frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').required(),
      interval: Joi.number().min(1).required(),
      endDate: Joi.date().iso().greater('now').required(),
      daysOfWeek: Joi.array().items(Joi.number().min(0).max(6)).optional(),
      dayOfMonth: Joi.number().min(1).max(31).optional()
    }).when('isRecurring', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  }),

  // Meeting update
  updateMeeting: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    description: Joi.string().max(1000).optional().allow(''),
    startTime: Joi.date().iso().optional(),
    endTime: Joi.date().iso().when('startTime', {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    timezone: Joi.string().optional(),
    location: Joi.string().max(200).optional().allow(''),
    agenda: Joi.array().items(Joi.object({
      item: Joi.string().trim().required(),
      duration: Joi.number().min(1).required()
    })).optional(),
    status: Joi.string().valid('scheduled', 'in_progress', 'completed', 'cancelled').optional()
  }),

  // Meeting response
  meetingResponse: Joi.object({
    response: Joi.string().valid('accepted', 'rejected', 'cancelled').required()
  }),

  // Document upload
  uploadDocument: Joi.object({
    title: Joi.string().trim().min(3).max(200).required(),
    description: Joi.string().max(1000).optional().allow(''),
    category: Joi.string().valid('contract', 'proposal', 'pitch_deck', 'financial', 'legal', 'other').optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
    accessLevel: Joi.string().valid('private', 'shared', 'public').optional(),
    expirationDate: Joi.date().iso().greater('now').optional()
  }),

  // Document update
  updateDocument: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    description: Joi.string().max(1000).optional().allow(''),
    category: Joi.string().valid('contract', 'proposal', 'pitch_deck', 'financial', 'legal', 'other').optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
    accessLevel: Joi.string().valid('private', 'shared', 'public').optional(),
    status: Joi.string().valid('draft', 'pending_review', 'approved', 'rejected', 'archived').optional(),
    expirationDate: Joi.date().iso().optional()
  }),

  // Document sharing
  shareDocument: Joi.object({
    userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    permission: Joi.string().valid('view', 'edit', 'admin').required()
  }),

  // Document signature
  signDocument: Joi.object({
    signatureImage: Joi.string().required()
  }),

  // Transaction creation
  createTransaction: Joi.object({
    amount: Joi.number().min(0.01).required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'INR').optional(),
    receiver: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    type: Joi.string().valid('deposit', 'withdraw', 'transfer', 'investment', 'payment').required(),
    paymentMethod: Joi.string().valid('stripe', 'paypal', 'bank_transfer', 'wallet').optional(),
    description: Joi.string().max(500).optional().allow(''),
    relatedMeeting: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    relatedDocument: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
  }),

  // Transaction update
  updateTransaction: Joi.object({
    status: Joi.string().valid('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded').optional(),
    description: Joi.string().max(500).optional().allow(''),
    notes: Joi.string().max(1000).optional().allow('')
  }),

  // Search and pagination
  searchQuery: Joi.object({
    q: Joi.string().trim().min(1).max(100).optional(),
    page: Joi.number().min(1).optional(),
    limit: Joi.number().min(1).max(100).optional(),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
    filters: Joi.object().optional()
  }),

  // 2FA verification
  verify2FA: Joi.object({
    twoFACode: Joi.string().length(6).pattern(/^\d+$/).required()
  })
};

// Custom validation functions
export const customValidators = {
  // Validate ObjectId
  isValidObjectId: (value, helpers) => {
    if (!/^[0-9a-fA-F]{24}$/.test(value)) {
      return helpers.error('custom.objectId');
    }
    return value;
  },

  // Validate date range
  isValidDateRange: (value, helpers) => {
    if (value.startTime && value.endTime && new Date(value.endTime) <= new Date(value.startTime)) {
      return helpers.error('custom.dateRange');
    }
    return value;
  },

  // Validate file size
  isValidFileSize: (value, helpers, maxSize) => {
    if (value > maxSize) {
      return helpers.error('custom.fileSize');
    }
    return value;
  },

  // Validate email uniqueness (async)
  isUniqueEmail: async (value, helpers) => {
    try {
      const User = (await import('../models/User.js')).default;
      const existingUser = await User.findOne({ email: value });
      if (existingUser) {
        return helpers.error('custom.emailExists');
      }
      return value;
    } catch (error) {
      return helpers.error('custom.validationError');
    }
  }
};

// Add custom error messages
Joi.object().custom((value, helpers) => {
  if (helpers.state.path.includes('userId') && !customValidators.isValidObjectId(value)) {
    return helpers.error('custom.objectId');
  }
  return value;
}, 'ObjectId validation');

export default {
  validate,
  schemas,
  customValidators
};
