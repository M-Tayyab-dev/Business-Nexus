import express from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate, verify2FA } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { rateLimiters } from '../middleware/security.js';

const router = express.Router();

// Public routes
router.post('/register', 
  rateLimiters.auth,
  validate(schemas.register),
  authController.register
);

router.post('/login', 
  rateLimiters.auth,
  validate(schemas.login),
  authController.login
);

router.post('/refresh-token', 
  rateLimiters.general,
  validate(schemas.refreshToken),
  authController.refreshToken
);

router.post('/verify-email', 
  rateLimiters.auth,
  validate(schemas.emailVerification),
  authController.verifyEmail
);

router.post('/request-password-reset', 
  rateLimiters.strict,
  validate(schemas.passwordResetRequest),
  authController.requestPasswordReset
);

router.post('/reset-password', 
  rateLimiters.strict,
  validate(schemas.passwordReset),
  authController.resetPassword
);

// Protected routes
router.post('/change-password', 
  authenticate,
  rateLimiters.auth,
  validate(schemas.changePassword),
  authController.changePassword
);

router.get('/profile', 
  authenticate,
  authController.getProfile
);

router.put('/profile', 
  authenticate,
  rateLimiters.general,
  validate(schemas.updateProfile),
  authController.updateProfile
);

router.post('/enable-2fa', 
  authenticate,
  rateLimiters.auth,
  authController.enable2FA
);

router.post('/logout', 
  authenticate,
  authController.logout
);

export default router;
