import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Document title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: ''
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploaded by user is required']
  },
  fileName: {
    type: String,
    required: [true, 'File name is required']
  },
  originalName: {
    type: String,
    required: [true, 'Original file name is required']
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required']
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required']
  },
  filePath: {
    type: String,
    required: [true, 'File path is required']
  },
  cloudinaryPublicId: {
    type: String,
    required: true
  },
  version: {
    type: Number,
    default: 1
  },
  category: {
    type: String,
    enum: ['contract', 'proposal', 'pitch_deck', 'financial', 'legal', 'other'],
    default: 'other'
  },
  tags: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['draft', 'pending_review', 'approved', 'rejected', 'archived'],
    default: 'draft'
  },
  accessLevel: {
    type: String,
    enum: ['private', 'shared', 'public'],
    default: 'private'
  },
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['view', 'edit', 'admin'],
      default: 'view'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  signatures: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    signatureImage: {
      type: String,
      required: true
    },
    signedAt: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    status: {
      type: String,
      enum: ['pending', 'signed', 'declined'],
      default: 'pending'
    }
  }],
  isTemplate: {
    type: Boolean,
    default: false
  },
  templateCategory: {
    type: String,
    default: ''
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloadedAt: {
    type: Date
  },
  expirationDate: {
    type: Date
  },
  isExpired: {
    type: Boolean,
    default: false
  },
  metadata: {
    extractedText: String,
    pageCount: Number,
    dimensions: {
      width: Number,
      height: Number
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual to check if document is expired
documentSchema.virtual('expired').get(function() {
  if (this.expirationDate) {
    return new Date() > this.expirationDate;
  }
  return false;
});

// Virtual for file size in human readable format
documentSchema.virtual('fileSizeFormatted').get(function() {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Indexes for efficient querying
documentSchema.index({ uploadedBy: 1, createdAt: -1 });
documentSchema.index({ category: 1, status: 1 });
documentSchema.index({ tags: 1 });
documentSchema.index({ 'sharedWith.user': 1 });
documentSchema.index({ 'signatures.user': 1 });

// Pre-save middleware to check expiration
documentSchema.pre('save', function(next) {
  if (this.expirationDate && new Date() > this.expirationDate) {
    this.isExpired = true;
  }
  next();
});

// Method to share document with user
documentSchema.methods.shareWithUser = function(userId, permission = 'view') {
  const existingShare = this.sharedWith.find(s => s.user.toString() === userId.toString());
  if (!existingShare) {
    this.sharedWith.push({
      user: userId,
      permission: permission
    });
  } else {
    existingShare.permission = permission;
    existingShare.sharedAt = new Date();
  }
  return this.save();
};

// Method to add signature request
documentSchema.methods.addSignatureRequest = function(userId) {
  const existingSignature = this.signatures.find(s => s.user.toString() === userId.toString());
  if (!existingSignature) {
    this.signatures.push({
      user: userId,
      status: 'pending'
    });
  }
  return this.save();
};

// Method to sign document
documentSchema.methods.signDocument = function(userId, signatureImage, ipAddress) {
  const signature = this.signatures.find(s => s.user.toString() === userId.toString());
  if (signature) {
    signature.signatureImage = signatureImage;
    signature.signedAt = new Date();
    signature.ipAddress = ipAddress;
    signature.status = 'signed';
  }
  return this.save();
};

// Method to increment download count
documentSchema.methods.incrementDownloadCount = function() {
  this.downloadCount += 1;
  this.lastDownloadedAt = new Date();
  return this.save();
};

// Static method to find documents shared with user
documentSchema.statics.findSharedWithUser = function(userId) {
  return this.find({
    $or: [
      { uploadedBy: userId },
      { 'sharedWith.user': userId },
      { accessLevel: 'public' }
    ]
  }).populate('uploadedBy', 'firstName lastName email profilePicture')
    .populate('sharedWith.user', 'firstName lastName email profilePicture')
    .populate('signatures.user', 'firstName lastName email profilePicture');
};

export default mongoose.model('Document', documentSchema);
