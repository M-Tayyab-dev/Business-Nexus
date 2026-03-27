import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// Import configurations and utilities
import connectDB from './src/config/database.js';
import { testCloudinaryConnection } from './src/config/cloudinary.js';
import { testStripeConnection } from './src/config/stripe.js';
import logger from './src/utils/logger.js';

// Import middleware
import {
  rateLimiters,
  helmetConfig,
  sanitizeInput,
  xssProtection,
  mongoInjectionProtection,
  hppProtection,
  requestSizeLimiter,
  corsMiddleware,
  securityHeaders,
  requestLogger,
  compressionMiddleware
} from './src/middleware/security.js';
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler.js';

// Import routes
import apiRoutes from './src/routes/index.js';

// Import Socket.IO handlers
import { handleSocketConnection } from './src/controllers/videoCallController.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Security middleware
app.use(helmetConfig);
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(compressionMiddleware);
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security and sanitization middleware
app.use(sanitizeInput);
app.use(xssProtection);
app.use(mongoInjectionProtection);
app.use(hppProtection);
app.use(requestSizeLimiter('10mb'));

// Rate limiting
app.use(rateLimiters.general);

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(requestLogger);
}

// API routes
const API_VERSION = process.env.API_VERSION || 'v1';
app.use(`/api/${API_VERSION}`, apiRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  handleSocketConnection(io, socket);
});

// Health check endpoint (before other middleware)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Nexus Backend API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// API documentation (Swagger placeholder)
app.get('/api-docs', (req, res) => {
  res.json({
    success: true,
    message: 'API Documentation',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/v1/auth/register',
        login: 'POST /api/v1/auth/login',
        refreshToken: 'POST /api/v1/auth/refresh-token',
        verifyEmail: 'POST /api/v1/auth/verify-email',
        requestPasswordReset: 'POST /api/v1/auth/request-password-reset',
        resetPassword: 'POST /api/v1/auth/reset-password',
        changePassword: 'POST /api/v1/auth/change-password',
        getProfile: 'GET /api/v1/auth/profile',
        updateProfile: 'PUT /api/v1/auth/profile',
        enable2FA: 'POST /api/v1/auth/enable-2fa',
        logout: 'POST /api/v1/auth/logout'
      },
      meetings: {
        create: 'POST /api/v1/meetings',
        getMyMeetings: 'GET /api/v1/meetings',
        getMeeting: 'GET /api/v1/meetings/:id',
        updateMeeting: 'PUT /api/v1/meetings/:id',
        respondToMeeting: 'POST /api/v1/meetings/:id/respond',
        addParticipant: 'POST /api/v1/meetings/:id/participants',
        removeParticipant: 'DELETE /api/v1/meetings/:id/participants/:participantId',
        cancelMeeting: 'DELETE /api/v1/meetings/:id',
        getMeetingConflicts: 'GET /api/v1/meetings/conflicts',
        getMeetingStats: 'GET /api/v1/meetings/stats'
      },
      videoCalls: {
        getActiveRooms: 'GET /api/v1/video-calls/active-rooms',
        getRoomParticipants: 'GET /api/v1/video-calls/rooms/:meetingId/participants',
        generateMeetingLink: 'POST /api/v1/video-calls/rooms/:meetingId/link',
        endMeeting: 'POST /api/v1/video-calls/rooms/:meetingId/end'
      },
      documents: {
        upload: 'POST /api/v1/documents',
        getMyDocuments: 'GET /api/v1/documents',
        getDocument: 'GET /api/v1/documents/:id',
        updateDocument: 'PUT /api/v1/documents/:id',
        deleteDocument: 'DELETE /api/v1/documents/:id',
        shareDocument: 'POST /api/v1/documents/:id/share',
        requestSignature: 'POST /api/v1/documents/:id/signatures/request',
        signDocument: 'POST /api/v1/documents/:id/sign',
        getDocumentVersions: 'GET /api/v1/documents/:id/versions',
        downloadDocument: 'GET /api/v1/documents/:id/download',
        getDocumentStats: 'GET /api/v1/documents/stats'
      },
      transactions: {
        createPaymentIntent: 'POST /api/v1/transactions/payment-intent',
        createTransaction: 'POST /api/v1/transactions',
        processPayment: 'POST /api/v1/transactions/:id/process',
        getMyTransactions: 'GET /api/v1/transactions',
        getTransaction: 'GET /api/v1/transactions/:id',
        updateTransaction: 'PUT /api/v1/transactions/:id',
        refundTransaction: 'POST /api/v1/transactions/:id/refund',
        getTransactionStats: 'GET /api/v1/transactions/stats',
        getWalletBalance: 'GET /api/v1/transactions/wallet/balance'
      }
    }
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    logger.info('Database connected successfully');

    // Test external services
    if (process.env.NODE_ENV === 'production') {
      await testCloudinaryConnection();
      await testStripeConnection();
    }

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      logger.info(`API endpoints available at: http://localhost:${PORT}/api/${API_VERSION}`);
      logger.info(`Health check available at: http://localhost:${PORT}/health`);
      logger.info(`API documentation at: http://localhost:${PORT}/api-docs`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

export default app;
