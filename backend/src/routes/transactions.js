import express from 'express';
import * as transactionController from '../controllers/transactionController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { rateLimiters } from '../middleware/security.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Payment and transaction management
router.post('/payment-intent', 
  rateLimiters.general,
  validate(schemas.searchQuery), // Reusing for amount validation
  transactionController.createPaymentIntent
);

router.post('/', 
  rateLimiters.general,
  validate(schemas.createTransaction),
  transactionController.createTransaction
);

router.post('/:id/process', 
  rateLimiters.general,
  validate(schemas.searchQuery), // Reusing for paymentMethodId validation
  transactionController.processPayment
);

router.get('/', 
  rateLimiters.general,
  transactionController.getMyTransactions
);

router.get('/stats', 
  rateLimiters.general,
  transactionController.getTransactionStats
);

router.get('/wallet/balance', 
  rateLimiters.general,
  transactionController.getWalletBalance
);

router.get('/:id', 
  rateLimiters.general,
  transactionController.getTransaction
);

router.put('/:id', 
  rateLimiters.general,
  validate(schemas.updateTransaction),
  transactionController.updateTransaction
);

router.post('/:id/refund', 
  rateLimiters.general,
  validate(schemas.searchQuery), // Reusing for amount validation
  transactionController.refundTransaction
);

export default router;
