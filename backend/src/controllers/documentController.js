import multer from 'multer';
import { cloudinary } from '../config/cloudinary.js';
import Document from '../models/Document.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import { sendDocumentNotification } from '../services/emailService.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 
                       'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, PDF, and Word documents are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 1
  },
  fileFilter
});

// Upload document
export const uploadDocument = asyncHandler(async (req, res) => {
  const { title, description, category, tags, accessLevel, expirationDate } = req.body;
  const uploadedBy = req.user.id;

  if (!req.file) {
    throw new ValidationError('No file uploaded');
  }

  try {
    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto',
          folder: 'nexus-documents',
          public_id: `${Date.now()}-${req.file.originalname}`,
          overwrite: true
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    // Create document record
    const document = new Document({
      title,
      description: description || '',
      uploadedBy,
      fileName: result.public_id,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: result.secure_url,
      cloudinaryPublicId: result.public_id,
      category: category || 'other',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      accessLevel: accessLevel || 'private',
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      metadata: {
        extractedText: result.context?.custom?.caption || '',
        pageCount: result.pages || 0,
        dimensions: {
          width: result.width,
          height: result.height
        }
      }
    });

    await document.save();

    // Populate document data
    await document.populate('uploadedBy', 'firstName lastName email profilePicture');

    logger.info(`Document uploaded: ${document._id} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: { document }
    });

  } catch (cloudinaryError) {
    logger.error('Cloudinary upload error:', cloudinaryError);
    throw new ValidationError('Failed to upload file to cloud storage');
  }
});

// Get documents for current user
export const getMyDocuments = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    category, 
    status, 
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const userId = req.user.id;
  const skip = (page - 1) * limit;

  // Build query
  const query = {
    $or: [
      { uploadedBy: userId },
      { 'sharedWith.user': userId },
      { accessLevel: 'public' }
    ]
  };

  if (category) {
    query.category = category;
  }

  if (status) {
    query.status = status;
  }

  if (search) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ]
    });
  }

  // Build sort
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const documents = await Document.find(query)
    .populate('uploadedBy', 'firstName lastName email profilePicture')
    .populate('sharedWith.user', 'firstName lastName email profilePicture')
    .populate('signatures.user', 'firstName lastName email profilePicture')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Document.countDocuments(query);

  res.json({
    success: true,
    data: {
      documents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get single document
export const getDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const document = await Document.findById(id)
    .populate('uploadedBy', 'firstName lastName email profilePicture')
    .populate('sharedWith.user', 'firstName lastName email profilePicture')
    .populate('signatures.user', 'firstName lastName email profilePicture');

  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check access permissions
  const hasAccess = document.uploadedBy._id.toString() === userId ||
                   document.accessLevel === 'public' ||
                   document.sharedWith.some(s => s.user._id.toString() === userId);

  if (!hasAccess) {
    throw new ValidationError('Access denied');
  }

  // Increment download count
  await document.incrementDownloadCount();

  res.json({
    success: true,
    data: { document }
  });
});

// Update document
export const updateDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const updates = req.body;

  const document = await Document.findById(id);
  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check if user is the owner
  if (document.uploadedBy.toString() !== userId) {
    throw new ValidationError('Only the document owner can update it');
  }

  // Update document
  Object.keys(updates).forEach(key => {
    if (key === 'tags' && typeof updates[key] === 'string') {
      document[key] = updates[key].split(',').map(tag => tag.trim());
    } else if (key === 'expirationDate' && updates[key]) {
      document[key] = new Date(updates[key]);
    } else {
      document[key] = updates[key];
    }
  });

  await document.save();

  await document.populate([
    { path: 'uploadedBy', select: 'firstName lastName email profilePicture' },
    { path: 'sharedWith.user', select: 'firstName lastName email profilePicture' },
    { path: 'signatures.user', select: 'firstName lastName email profilePicture' }
  ]);

  logger.info(`Document updated: ${document._id} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Document updated successfully',
    data: { document }
  });
});

// Delete document
export const deleteDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const document = await Document.findById(id);
  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check if user is the owner
  if (document.uploadedBy.toString() !== userId) {
    throw new ValidationError('Only the document owner can delete it');
  }

  // Delete from Cloudinary
  try {
    await cloudinary.uploader.destroy(document.cloudinaryPublicId);
  } catch (cloudinaryError) {
    logger.error('Cloudinary deletion error:', cloudinaryError);
    // Continue with database deletion even if cloudinary fails
  }

  // Delete from database
  await Document.findByIdAndDelete(id);

  logger.info(`Document deleted: ${id} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Document deleted successfully'
  });
});

// Share document with user
export const shareDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId: targetUserId, permission } = req.body;
  const userId = req.user.id;

  const document = await Document.findById(id);
  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check if user is the owner
  if (document.uploadedBy.toString() !== userId) {
    throw new ValidationError('Only the document owner can share it');
  }

  // Validate target user
  const targetUser = await User.findById(targetUserId);
  if (!targetUser || !targetUser.isActive) {
    throw new ValidationError('Invalid user');
  }

  // Share document
  await document.shareWithUser(targetUserId, permission);

  // Send notification
  try {
    await sendDocumentNotification(document, targetUser, 'shared');
  } catch (emailError) {
    logger.error('Failed to send document notification:', emailError);
  }

  await document.populate([
    { path: 'uploadedBy', select: 'firstName lastName email profilePicture' },
    { path: 'sharedWith.user', select: 'firstName lastName email profilePicture' }
  ]);

  logger.info(`Document shared: ${id} with ${targetUserId} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Document shared successfully',
    data: { document }
  });
});

// Request signature
export const requestSignature = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId: signerId } = req.body;
  const userId = req.user.id;

  const document = await Document.findById(id);
  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check if user is the owner
  if (document.uploadedBy.toString() !== userId) {
    throw new ValidationError('Only the document owner can request signatures');
  }

  // Validate signer
  const signer = await User.findById(signerId);
  if (!signer || !signer.isActive) {
    throw new ValidationError('Invalid signer');
  }

  // Add signature request
  await document.addSignatureRequest(signerId);

  // Send notification
  try {
    await sendDocumentNotification(document, signer, 'signature requested');
  } catch (emailError) {
    logger.error('Failed to send signature notification:', emailError);
  }

  logger.info(`Signature requested: document ${id} for ${signerId} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Signature request sent successfully'
  });
});

// Sign document
export const signDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { signatureImage } = req.body;
  const userId = req.user.id;
  const ipAddress = req.ip;

  const document = await Document.findById(id);
  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check if user has a pending signature request
  const signatureRequest = document.signatures.find(s => 
    s.user.toString() === userId && s.status === 'pending'
  );

  if (!signatureRequest) {
    throw new ValidationError('No pending signature request found');
  }

  // Sign document
  await document.signDocument(userId, signatureImage, ipAddress);

  await document.populate([
    { path: 'uploadedBy', select: 'firstName lastName email profilePicture' },
    { path: 'signatures.user', select: 'firstName lastName email profilePicture' }
  ]);

  logger.info(`Document signed: ${id} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Document signed successfully',
    data: { document }
  });
});

// Get document versions (mock for now)
export const getDocumentVersions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const document = await Document.findById(id);
  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check access
  const hasAccess = document.uploadedBy.toString() === userId ||
                   document.accessLevel === 'public' ||
                   document.sharedWith.some(s => s.user.toString() === userId);

  if (!hasAccess) {
    throw new ValidationError('Access denied');
  }

  // Mock version history (in a real app, this would come from the database)
  const versions = [
    {
      version: document.version,
      uploadedBy: document.uploadedBy,
      uploadedAt: document.createdAt,
      fileSize: document.fileSize,
      fileName: document.originalName
    }
  ];

  res.json({
    success: true,
    data: {
      document: document,
      versions
    }
  });
});

// Get document statistics
export const getDocumentStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { period = 'month' } = req.query;

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

  const stats = await Document.aggregate([
    {
      $match: {
        uploadedBy: userId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalSize: { $sum: '$fileSize' },
        totalDownloads: { $sum: '$downloadCount' }
      }
    }
  ]);

  const totalDocuments = await Document.countDocuments({
    uploadedBy: userId,
    createdAt: { $gte: startDate }
  });

  const sharedDocuments = await Document.countDocuments({
    uploadedBy: userId,
    'sharedWith.0': { $exists: true },
    createdAt: { $gte: startDate }
  });

  res.json({
    success: true,
    data: {
      stats,
      totalDocuments,
      sharedDocuments,
      period
    }
  });
});

// Download document
export const downloadDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const document = await Document.findById(id);
  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check access
  const hasAccess = document.uploadedBy.toString() === userId ||
                   document.accessLevel === 'public' ||
                   document.sharedWith.some(s => s.user.toString() === userId);

  if (!hasAccess) {
    throw new ValidationError('Access denied');
  }

  // Increment download count
  await document.incrementDownloadCount();

  // Redirect to Cloudinary URL
  res.redirect(document.filePath);
});

export { upload };
