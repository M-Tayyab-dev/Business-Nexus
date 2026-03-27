import express from 'express';
import * as meetingController from '../controllers/meetingController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { rateLimiters } from '../middleware/security.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Meeting CRUD
router.post('/', 
  rateLimiters.general,
  validate(schemas.createMeeting),
  meetingController.createMeeting
);

router.get('/', 
  rateLimiters.general,
  meetingController.getMyMeetings
);

router.get('/stats', 
  rateLimiters.general,
  meetingController.getMeetingStats
);

router.get('/conflicts', 
  rateLimiters.general,
  meetingController.getMeetingConflicts
);

router.get('/:id', 
  rateLimiters.general,
  meetingController.getMeeting
);

router.put('/:id', 
  rateLimiters.general,
  validate(schemas.updateMeeting),
  meetingController.updateMeeting
);

router.post('/:id/respond', 
  rateLimiters.general,
  validate(schemas.meetingResponse),
  meetingController.respondToMeeting
);

router.post('/:id/participants', 
  rateLimiters.general,
  validate(schemas.searchQuery), // Reusing for participant validation
  meetingController.addParticipant
);

router.delete('/:id/participants/:participantId', 
  rateLimiters.general,
  meetingController.removeParticipant
);

router.delete('/:id', 
  rateLimiters.general,
  meetingController.cancelMeeting
);

export default router;
