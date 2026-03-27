import express from 'express';
import * as videoCallController from '../controllers/videoCallController.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimiters } from '../middleware/security.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Video call management
router.get('/active-rooms', 
  rateLimiters.general,
  videoCallController.getActiveRooms
);

router.get('/rooms/:meetingId/participants', 
  rateLimiters.general,
  videoCallController.getRoomParticipants
);

router.post('/rooms/:meetingId/link', 
  rateLimiters.general,
  videoCallController.generateMeetingLink
);

router.post('/rooms/:meetingId/end', 
  rateLimiters.general,
  videoCallController.endMeeting
);

export default router;
