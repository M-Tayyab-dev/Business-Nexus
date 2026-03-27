import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'INR']
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required']
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Receiver is required']
  },
  type: {
    type: String,
    enum: ['deposit', 'withdraw', 'transfer', 'investment', 'payment'],
    required: [true, 'Transaction type is required']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal', 'bank_transfer', 'wallet'],
    default: 'stripe'
  },
  paymentIntentId: {
    type: String,
    unique: true,
    sparse: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  fees: {
    processing: {
      type: Number,
      default: 0
    },
    platform: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  },
  netAmount: {
    type: Number,
    required: true
  },
  processedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  failureReason: {
    type: String
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  refundedAt: {
    type: Date
  },
  refundReason: {
    type: String
  },
  relatedMeeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting'
  },
  relatedDocument: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  receiptUrl: {
    type: String
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringInterval: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly']
  },
  nextRecurringDate: {
    type: Date
  },
  parentTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  childTransactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  internalNotes: {
    type: String,
    maxlength: [1000, 'Internal notes cannot exceed 1000 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for transaction duration
transactionSchema.virtual('processingDuration').get(function() {
  if (this.processedAt && this.completedAt) {
    return this.completedAt - this.processedAt;
  }
  return 0;
});

// Virtual for transaction age
transactionSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt;
});

// Indexes for efficient querying
transactionSchema.index({ sender: 1, createdAt: -1 });
transactionSchema.index({ receiver: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ paymentIntentId: 1 });
transactionSchema.index({ invoiceNumber: 1 });
transactionSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate net amount and fees
transactionSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('fees')) {
    this.fees.total = this.fees.processing + this.fees.platform;
    this.netAmount = this.amount - this.fees.total;
  }
  
  // Generate invoice number for completed transactions
  if (this.isModified('status') && this.status === 'completed' && !this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.invoiceNumber = `INV-${year}${month}-${random}`;
  }
  
  next();
});

// Method to mark as processed
transactionSchema.methods.markAsProcessed = function() {
  this.status = 'processing';
  this.processedAt = new Date();
  return this.save();
};

// Method to mark as completed
transactionSchema.methods.markAsCompleted = function(receiptUrl) {
  this.status = 'completed';
  this.completedAt = new Date();
  if (receiptUrl) {
    this.receiptUrl = receiptUrl;
  }
  return this.save();
};

// Method to mark as failed
transactionSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.failureReason = reason;
  return this.save();
};

// Method to refund transaction
transactionSchema.methods.refund = function(amount, reason) {
  this.refundAmount = amount;
  this.refundReason = reason;
  this.refundedAt = new Date();
  this.status = 'refunded';
  return this.save();
};

// Static method to find user transactions
transactionSchema.statics.findUserTransactions = function(userId, options = {}) {
  const query = {
    $or: [
      { sender: userId },
      { receiver: userId }
    ]
  };
  
  if (options.type) {
    query.type = options.type;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.startDate && options.endDate) {
    query.createdAt = {
      $gte: options.startDate,
      $lte: options.endDate
    };
  }
  
  return this.find(query)
    .populate('sender', 'firstName lastName email')
    .populate('receiver', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

// Static method to get transaction statistics
transactionSchema.statics.getTransactionStats = function(userId, period = 'month') {
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  
  return this.aggregate([
    {
      $match: {
        $or: [
          { sender: mongoose.Types.ObjectId(userId) },
          { receiver: mongoose.Types.ObjectId(userId) }
        ],
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
};

export default mongoose.model('Transaction', transactionSchema);
