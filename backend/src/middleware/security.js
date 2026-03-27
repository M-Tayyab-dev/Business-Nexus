import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import compression from 'compression';
import logger from '../utils/logger.js';

// Rate limiting configurations
export const rateLimiters = {
  // General rate limiter
  general: rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
      res.status(429).json({
        success: false,
        message: 'Too many requests from this IP, please try again later.'
      });
    }
  }),

  // Strict rate limiter for sensitive endpoints
  strict: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
      success: false,
      message: 'Too many attempts, please try again later.'
    },
    skipSuccessfulRequests: false,
    handler: (req, res) => {
      logger.warn(`Strict rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
      res.status(429).json({
        success: false,
        message: 'Too many attempts, please try again later.'
      });
    }
  }),

  // Auth rate limiter (for login, register, etc.)
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 auth requests per windowMs
    message: {
      success: false,
      message: 'Too many authentication attempts, please try again later.'
    },
    skipSuccessfulRequests: true,
    handler: (req, res) => {
      logger.warn(`Auth rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
      res.status(429).json({
        success: false,
        message: 'Too many authentication attempts, please try again later.'
      });
    }
  }),

  // Upload rate limiter
  upload: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // limit each IP to 20 uploads per hour
    message: {
      success: false,
      message: 'Upload limit exceeded, please try again later.'
    },
    handler: (req, res) => {
      logger.warn(`Upload rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
      res.status(429).json({
        success: false,
        message: 'Upload limit exceeded, please try again later.'
      });
    }
  })
};

// Helmet configuration
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input sanitization middleware
export const sanitizeInput = (req, res, next) => {
  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }

  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].trim();
      }
    });
  }

  // Sanitize URL parameters
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = req.params[key].trim();
      }
    });
  }

  next();
};

// XSS protection middleware
export const xssProtection = (req, res, next) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi
  ];

  const checkForXSS = (obj) => {
    if (typeof obj === 'string') {
      return xssPatterns.some(pattern => pattern.test(obj));
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForXSS(value));
    }
    return false;
  };

  if (checkForXSS(req.body) || checkForXSS(req.query) || checkForXSS(req.params)) {
    logger.warn(`XSS attempt detected from IP: ${req.ip}, Path: ${req.path}`);
    return res.status(400).json({
      success: false,
      message: 'Invalid input detected'
    });
  }

  next();
};

// SQL injection protection (for MongoDB)
export const mongoInjectionProtection = mongoSanitize({
  onSanitize: ({ req, key }) => {
    logger.warn(`MongoDB injection attempt detected from IP: ${req.ip}, Key: ${key}, Path: ${req.path}`);
  }
});

// HTTP Parameter Pollution protection
export const hppProtection = hpp({
  whitelist: ['tags', 'interests', 'participants', 'filters']
});

// Request size limiter
export const requestSizeLimiter = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.get('content-length');
    const maxBytes = parseSize(maxSize);

    if (contentLength && parseInt(contentLength) > maxBytes) {
      logger.warn(`Request size limit exceeded from IP: ${req.ip}, Size: ${contentLength}`);
      return res.status(413).json({
        success: false,
        message: 'Request size too large'
      });
    }

    next();
  };
};

// Helper function to parse size string to bytes
const parseSize = (size) => {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)$/);
  if (!match) return 10 * 1024 * 1024; // Default 10MB
  return parseInt(match[1]) * units[match[2]];
};

// IP whitelist middleware
export const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    if (allowedIPs.length === 0) {
      return next(); // No whitelist configured
    }

    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (!allowedIPs.includes(clientIP)) {
      logger.warn(`IP not in whitelist: ${clientIP}, Path: ${req.path}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    next();
  };
};

// CORS middleware
export const corsMiddleware = (req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];
  const origin = req.get('Origin');

  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
};

// Security headers middleware
export const securityHeaders = (req, res, next) => {
  // Additional security headers
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
};

// Request logger middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request Warning', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};

// Compress responses
export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
});

export default {
  rateLimiters,
  helmetConfig,
  sanitizeInput,
  xssProtection,
  mongoInjectionProtection,
  hppProtection,
  requestSizeLimiter,
  ipWhitelist,
  corsMiddleware,
  securityHeaders,
  requestLogger,
  compressionMiddleware
};
