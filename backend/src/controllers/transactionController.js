import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { stripe } from '../config/stripe.js';
import logger from '../utils/logger.js';
import { sendPaymentNotification } from '../services/emailService.js';
import { asyncHandler, NotFoundError, ValidationError, ConflictError } from '../middleware/errorHandler.js';

// Create transaction (mock implementation)
export const createTransaction = asyncHandler(async (req, res) => {
  const {
    amount,
    currency,
    receiver,
    type,
    paymentMethod,
    description,
    relatedMeeting,
    relatedDocument
  } = req.body;
  const sender = req.user.id;

  // Validate receiver
  const receiverUser = await User.findById(receiver);
  if (!receiverUser || !receiverUser.isActive) {
    throw new ValidationError('Invalid receiver');
  }

  // Check if sender and receiver are the same
  if (sender === receiver) {
    throw new ValidationError('Cannot send transaction to yourself');
  }

  // Validate amount
  if (amount <= 0) {
    throw new ValidationError('Amount must be greater than 0');
  }

  // Create transaction
  const transaction = new Transaction({
    amount,
    currency: currency || 'USD',
    sender,
    receiver,
    type,
    paymentMethod: paymentMethod || 'stripe',
    description: description || '',
    relatedMeeting,
    relatedDocument,
    status: 'pending'
  });

  await transaction.save();

  // Populate transaction data
  await transaction.populate([
    { path: 'sender', select: 'firstName lastName email profilePicture' },
    { path: 'receiver', select: 'firstName lastName email profilePicture' }
  ]);

  logger.info(`Transaction created: ${transaction._id} from ${req.user.email} to ${receiverUser.email}`);

  res.status(201).json({
    success: true,
    message: 'Transaction created successfully',
    data: { transaction }
  });
});

// Process payment with Stripe (mock)
export const processPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentMethodId } = req.body;

  const transaction = await Transaction.findById(id)
    .populate('sender', 'firstName lastName email')
    .populate('receiver', 'firstName lastName email');

  if (!transaction) {
    throw new NotFoundError('Transaction');
  }

  // Check if transaction belongs to current user
  if (transaction.sender._id.toString() !== req.user.id) {
    throw new ValidationError('Access denied');
  }

  // Check if transaction is already processed
  if (transaction.status !== 'pending') {
    throw new ValidationError('Transaction is already processed');
  }

  try {
    // Mark as processing
    await transaction.markAsProcessed();

    // Mock Stripe payment processing
    let paymentIntent;
    if (process.env.NODE_ENV === 'production') {
      // Real Stripe integration
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(transaction.amount * 100), // Convert to cents
        currency: transaction.currency.toLowerCase(),
        payment_method: paymentMethodId,
        confirm: true,
        metadata: {
          transactionId: transaction._id.toString(),
          senderId: transaction.sender._id.toString(),
          receiverId: transaction.receiver._id.toString()
        }
      });

      if (paymentIntent.status !== 'succeeded') {
        await transaction.markAsFailed('Payment failed');
        throw new ValidationError('Payment processing failed');
      }
    } else {
      // Mock payment for development
      paymentIntent = {
        id: `pi_mock_${Date.now()}`,
        status: 'succeeded'
      };

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Update transaction
    transaction.paymentIntentId = paymentIntent.id;
    transaction.fees.processing = transaction.amount * 0.029; // 2.9% processing fee
    transaction.fees.platform = transaction.amount * 0.01; // 1% platform fee
    await transaction.markAsCompleted(`https://nexus.com/receipts/${transaction._id}`);

    // Send email notifications
    try {
      await sendPaymentNotification(transaction, transaction.sender);
      await sendPaymentNotification(transaction, transaction.receiver);
    } catch (emailError) {
      logger.error('Failed to send payment notifications:', emailError);
    }

    logger.info(`Payment processed: ${transaction._id} - Stripe ID: ${paymentIntent.id}`);

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: { transaction }
    });

  } catch (stripeError) {
    logger.error('Stripe payment error:', stripeError);
    await transaction.markAsFailed(stripeError.message);
    
    throw new ValidationError('Payment processing failed');
  }
});

// Get transactions for current user
export const getMyTransactions = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    type, 
    status, 
    startDate, 
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const userId = req.user.id;
  const skip = (page - 1) * limit;

  // Build options
  const options = {};
  if (type) options.type = type;
  if (status) options.status = status;
  if (startDate && endDate) {
    options.startDate = new Date(startDate);
    options.endDate = new Date(endDate);
  }

  // Build sort
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const transactions = await Transaction.findUserTransactions(userId, options)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Transaction.countDocuments({
    $or: [
      { sender: userId },
      { receiver: userId }
    ],
    ...(type && { type }),
    ...(status && { status }),
    ...(startDate && endDate && {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
  });

  res.json({
    success: true,
    data: {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get single transaction
export const getTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const transaction = await Transaction.findById(id)
    .populate('sender', 'firstName lastName email profilePicture')
    .populate('receiver', 'firstName lastName email profilePicture')
    .populate('relatedMeeting', 'title startTime endTime')
    .populate('relatedDocument', 'title category');

  if (!transaction) {
    throw new NotFoundError('Transaction');
  }

  // Check if user has access to this transaction
  const hasAccess = transaction.sender._id.toString() === userId ||
                   transaction.receiver._id.toString() === userId;

  if (!hasAccess) {
    throw new ValidationError('Access denied');
  }

  res.json({
    success: true,
    data: { transaction }
  });
});

// Update transaction status (admin only or for refunds)
export const updateTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const userId = req.user.id;

  const transaction = await Transaction.findById(id)
    .populate('sender', 'firstName lastName email')
    .populate('receiver', 'firstName lastName email');

  if (!transaction) {
    throw new NotFoundError('Transaction');
  }

  // Check if user is sender or admin
  const isSender = transaction.sender._id.toString() === userId;
  const isAdmin = req.user.role === 'admin';

  if (!isSender && !isAdmin) {
    throw new ValidationError('Access denied');
  }

  // Validate status transition
  const validTransitions = {
    'pending': ['cancelled'],
    'processing': ['failed', 'completed'],
    'completed': ['refunded'],
    'failed': ['pending'],
    'cancelled': ['pending']
  };

  if (!validTransitions[transaction.status]?.includes(status)) {
    throw new ValidationError(`Invalid status transition from ${transaction.status} to ${status}`);
  }

  // Update transaction
  transaction.status = status;
  if (notes) transaction.notes = notes;

  if (status === 'completed') {
    transaction.completedAt = new Date();
  } else if (status === 'failed') {
    transaction.failedAt = new Date();
  } else if (status === 'refunded') {
    transaction.refundedAt = new Date();
    transaction.refundAmount = transaction.amount;
  }

  await transaction.save();

  // Send notifications for status changes
  try {
    if (status === 'completed') {
      await sendPaymentNotification(transaction, transaction.sender);
      await sendPaymentNotification(transaction, transaction.receiver);
    }
  } catch (emailError) {
    logger.error('Failed to send payment notifications:', emailError);
  }

  logger.info(`Transaction updated: ${id} to status ${status} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Transaction updated successfully',
    data: { transaction }
  });
});

// Refund transaction
export const refundTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body;
  const userId = req.user.id;

  const transaction = await Transaction.findById(id)
    .populate('sender', 'firstName lastName email')
    .populate('receiver', 'firstName lastName email');

  if (!transaction) {
    throw new NotFoundError('Transaction');
  }

  // Check if user is sender or admin
  const isSender = transaction.sender._id.toString() === userId;
  const isAdmin = req.user.role === 'admin';

  if (!isSender && !isAdmin) {
    throw new ValidationError('Access denied');
  }

  // Check if transaction can be refunded
  if (transaction.status !== 'completed') {
    throw new ValidationError('Only completed transactions can be refunded');
  }

  if (transaction.refundAmount > 0) {
    throw new ValidationError('Transaction has already been refunded');
  }

  // Validate refund amount
  const refundAmount = amount || transaction.amount;
  if (refundAmount > transaction.amount) {
    throw new ValidationError('Refund amount cannot exceed transaction amount');
  }

  try {
    // Process refund with Stripe (mock)
    if (process.env.NODE_ENV === 'production' && transaction.paymentIntentId) {
      const refund = await stripe.refunds.create({
        payment_intent: transaction.paymentIntentId,
        amount: Math.round(refundAmount * 100) // Convert to cents
      });

      if (refund.status !== 'succeeded') {
        throw new ValidationError('Refund processing failed');
      }
    }

    // Update transaction
    await transaction.refund(refundAmount, reason || 'Refund requested');

    // Send notifications
    try {
      await sendPaymentNotification(transaction, transaction.sender);
      await sendPaymentNotification(transaction, transaction.receiver);
    } catch (emailError) {
      logger.error('Failed to send refund notifications:', emailError);
    }

    logger.info(`Transaction refunded: ${id} amount ${refundAmount} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: { transaction }
    });

  } catch (stripeError) {
    logger.error('Stripe refund error:', stripeError);
    throw new ValidationError('Refund processing failed');
  }
});

// Get transaction statistics
export const getTransactionStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { period = 'month' } = req.query;

  const stats = await Transaction.getTransactionStats(userId, period);

  // Get additional stats
  const totalSent = await Transaction.aggregate([
    {
      $match: {
        sender: userId,
        status: 'completed',
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  const totalReceived = await Transaction.aggregate([
    {
      $match: {
        receiver: userId,
        status: 'completed',
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      stats,
      totalSent: totalSent[0] || { totalAmount: 0, count: 0 },
      totalReceived: totalReceived[0] || { totalAmount: 0, count: 0 },
      period
    }
  });
});

// Get wallet balance (mock)
export const getWalletBalance = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Calculate balance from completed transactions
  const sentTransactions = await Transaction.find({
    sender: userId,
    status: 'completed'
  });

  const receivedTransactions = await Transaction.find({
    receiver: userId,
    status: 'completed'
  });

  const totalSent = sentTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const totalReceived = receivedTransactions.reduce((sum, tx) => sum + tx.netAmount, 0);

  const balance = totalReceived - totalSent;

  res.json({
    success: true,
    data: {
      balance,
      totalSent,
      totalReceived,
      currency: 'USD'
    }
  });
});

// Create payment intent for Stripe
export const createPaymentIntent = asyncHandler(async (req, res) => {
  const { amount, currency = 'USD' } = req.body;

  if (!amount || amount <= 0) {
    throw new ValidationError('Invalid amount');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        userId: req.user.id
      }
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });

  } catch (stripeError) {
    logger.error('Create payment intent error:', stripeError);
    throw new ValidationError('Failed to create payment intent');
  }
});
