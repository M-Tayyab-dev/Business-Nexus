import express from 'express';
import authRoutes from './auth.js';
import meetingRoutes from './meetings.js';
import videoCallRoutes from './videoCalls.js';
import documentRoutes from './documents.js';
import transactionRoutes from './transactions.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Nexus Backend API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/meetings', meetingRoutes);
router.use('/video-calls', videoCallRoutes);
router.use('/documents', documentRoutes);
router.use('/transactions', transactionRoutes);

// API info
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Nexus Backend API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      meetings: '/api/v1/meetings',
      videoCalls: '/api/v1/video-calls',
      documents: '/api/v1/documents',
      transactions: '/api/v1/transactions',
      health: '/api/v1/health'
    },
    documentation: '/api/v1/docs'
  });
});

export default router;
