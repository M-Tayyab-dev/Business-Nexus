import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import logger from '../utils/logger.js';

// Authentication middleware
export const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found'
      });
    }

    // Add user to request object
    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication'
    });
  }
};

// Role-based authorization middleware
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (user && user.isActive) {
        req.user = {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

// Check if user can access resource (owner or admin)
export const checkResourceAccess = (resourceField = 'user') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const resource = req[resourceField];
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }

    // Check if user is the owner or admin
    const isOwner = resource.user?.toString() === req.user.id ||
                    resource.uploadedBy?.toString() === req.user.id ||
                    resource.organizer?.toString() === req.user.id ||
                    resource._id?.toString() === req.user.id;

    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    next();
  };
};

// 2FA verification middleware
export const verify2FA = async (req, res, next) => {
  try {
    const { twoFACode } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId).select('+twoFactorSecret +twoFactorEnabled');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorEnabled) {
      return next(); // Skip 2FA if not enabled
    }

    if (!twoFACode) {
      return res.status(400).json({
        success: false,
        message: '2FA code is required'
      });
    }

    if (twoFACode !== user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 2FA code'
      });
    }

    next();
  } catch (error) {
    logger.error('2FA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during 2FA verification'
    });
  }
};

// Email verification middleware
export const requireEmailVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    next();
  } catch (error) {
    logger.error('Email verification check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during email verification check'
    });
  }
};

export default {
  authenticate,
  authorize,
  optionalAuth,
  checkResourceAccess,
  verify2FA,
  requireEmailVerification
};
