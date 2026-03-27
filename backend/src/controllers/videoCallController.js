import logger from '../utils/logger.js';
import Meeting from '../models/Meeting.js';
import User from '../models/User.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

// Store active rooms and participants
const activeRooms = new Map();
const roomParticipants = new Map();

// Socket.IO event handlers
export const handleSocketConnection = (io, socket) => {
  const userId = socket.handshake.auth.userId;
  
  if (!userId) {
    socket.disconnect();
    return;
  }

  logger.info(`User connected to video call: ${userId}`);

  // Join room
  socket.on('join-room', async (data) => {
    try {
      const { meetingId, userName } = data;

      let hasAccess = true;
      let meeting = null;
      
      // Attempt to verify in DB, if it's a mongo objectId. If not, or if memory db is empty, allow ad-hoc chat room
      if (meetingId && meetingId.length === 24) {
        meeting = await Meeting.findById(meetingId)
          .populate('organizer', 'firstName lastName')
          .populate('participants.user', 'firstName lastName');
          
        if (meeting) {
          hasAccess = meeting.organizer._id.toString() === userId ||
                           meeting.participants.some(p => p.user._id.toString() === userId);
        }
      }

      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Join socket room
      socket.join(meetingId);

      // Track participant
      if (!roomParticipants.has(meetingId)) {
        roomParticipants.set(meetingId, new Set());
      }
      roomParticipants.get(meetingId).add(userId);

      // Store socket mapping
      if (!activeRooms.has(userId)) {
        activeRooms.set(userId, new Set());
      }
      activeRooms.get(userId).add(socket.id);

      // Notify others in room
      socket.to(meetingId).emit('user-joined', {
        userId,
        userName: userName || socket.handshake.auth.userName,
        socketId: socket.id
      });

      // Send current room info to new participant
      const participants = Array.from(roomParticipants.get(meetingId) || []);
      socket.emit('room-info', {
        meetingId,
        participants,
        participantCount: participants.length
      });

      // Update meeting status if needed
      if (meeting && meeting.status === 'scheduled') {
        const now = new Date();
        if (now >= meeting.startTime && now <= meeting.endTime) {
          meeting.status = 'in_progress';
          await meeting.save();
          
          // Notify all participants
          io.to(meetingId).emit('meeting-status-changed', {
            status: 'in_progress',
            meetingId
          });
        }
      }

      logger.info(`User ${userId} joined room ${meetingId}`);

    } catch (error) {
      logger.error('Join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Leave room
  socket.on('leave-room', (data) => {
    const { meetingId } = data;
    
    socket.leave(meetingId);
    
    // Remove participant tracking
    if (roomParticipants.has(meetingId)) {
      roomParticipants.get(meetingId).delete(userId);
      if (roomParticipants.get(meetingId).size === 0) {
        roomParticipants.delete(meetingId);
      }
    }

    // Remove socket mapping
    if (activeRooms.has(userId)) {
      activeRooms.get(userId).delete(socket.id);
      if (activeRooms.get(userId).size === 0) {
        activeRooms.delete(userId);
      }
    }

    // Notify others
    socket.to(meetingId).emit('user-left', {
      userId,
      socketId: socket.id
    });

    logger.info(`User ${userId} left room ${meetingId}`);
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    const { targetUserId, offer, meetingId } = data;
    socket.to(meetingId).emit('offer', {
      fromUserId: userId,
      fromSocketId: socket.id,
      offer
    });
  });

  socket.on('answer', (data) => {
    const { targetUserId, answer, meetingId } = data;
    socket.to(meetingId).emit('answer', {
      fromUserId: userId,
      fromSocketId: socket.id,
      answer
    });
  });

  socket.on('ice-candidate', (data) => {
    const { targetUserId, candidate, meetingId } = data;
    socket.to(meetingId).emit('ice-candidate', {
      fromUserId: userId,
      fromSocketId: socket.id,
      candidate
    });
  });

  // Mute/unmute events
  socket.on('mute-audio', (data) => {
    const { meetingId, muted } = data;
    socket.to(meetingId).emit('user-audio-changed', {
      userId,
      muted
    });
  });

  socket.on('mute-video', (data) => {
    const { meetingId, muted } = data;
    socket.to(meetingId).emit('user-video-changed', {
      userId,
      muted
    });
  });

  // Screen sharing
  socket.on('start-screen-share', (data) => {
    const { meetingId } = data;
    socket.to(meetingId).emit('screen-share-started', {
      userId
    });
  });

  socket.on('stop-screen-share', (data) => {
    const { meetingId } = data;
    socket.to(meetingId).emit('screen-share-stopped', {
      userId
    });
  });

  // Chat in meeting
  socket.on('send-message', (data) => {
    const { meetingId, message } = data;
    
    // Add timestamp and user info
    const chatMessage = {
      id: Date.now().toString(),
      userId,
      userName: socket.handshake.auth.userName,
      message,
      timestamp: new Date(),
      type: 'text'
    };

    io.to(meetingId).emit('new-message', chatMessage);
  });

  // Raise hand
  socket.on('raise-hand', (data) => {
    const { meetingId, raised } = data;
    socket.to(meetingId).emit('hand-raised', {
      userId,
      raised
    });
  });

  // Request to speak
  socket.on('request-to-speak', (data) => {
    const { meetingId } = data;
    socket.to(meetingId).emit('speak-request', {
      userId,
      userName: socket.handshake.auth.userName
    });
  });

  // Recording events
  socket.on('start-recording', async (data) => {
    try {
      const { meetingId } = data;
      
      // Check if user is organizer
      const meeting = await Meeting.findById(meetingId);
      if (!meeting || meeting.organizer.toString() !== userId) {
        socket.emit('error', { message: 'Only organizer can start recording' });
        return;
      }

      // Notify all participants
      io.to(meetingId).emit('recording-started', {
        userId,
        timestamp: new Date()
      });

      logger.info(`Recording started for meeting ${meetingId} by user ${userId}`);

    } catch (error) {
      logger.error('Start recording error:', error);
      socket.emit('error', { message: 'Failed to start recording' });
    }
  });

  socket.on('stop-recording', async (data) => {
    try {
      const { meetingId } = data;
      
      // Check if user is organizer
      const meeting = await Meeting.findById(meetingId);
      if (!meeting || meeting.organizer.toString() !== userId) {
        socket.emit('error', { message: 'Only organizer can stop recording' });
        return;
      }

      // Notify all participants
      io.to(meetingId).emit('recording-stopped', {
        userId,
        timestamp: new Date()
      });

      // Update meeting with recording info (mock)
      meeting.recording = {
        url: `https://nexus.com/recordings/${meetingId}_${Date.now()}.mp4`,
        duration: Math.floor((Date.now() - meeting.startTime.getTime()) / 1000 / 60), // minutes
        recordedAt: new Date()
      };
      await meeting.save();

      logger.info(`Recording stopped for meeting ${meetingId} by user ${userId}`);

    } catch (error) {
      logger.error('Stop recording error:', error);
      socket.emit('error', { message: 'Failed to stop recording' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info(`User disconnected from video call: ${userId}`);

    // Clean up from all rooms
    for (const [meetingId, participants] of roomParticipants.entries()) {
      if (participants.has(userId)) {
        participants.delete(userId);
        
        // Notify others in room
        socket.to(meetingId).emit('user-left', {
          userId,
          socketId: socket.id
        });

        if (participants.size === 0) {
          roomParticipants.delete(meetingId);
        }
      }
    }

    // Clean up socket mappings
    activeRooms.delete(userId);
  });

  // Error handling
  socket.on('error', (error) => {
    logger.error(`Socket error for user ${userId}:`, error);
  });
};

// Get active rooms for a user
export const getActiveRooms = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get meetings where user is organizer or participant and status is in_progress
  const activeMeetings = await Meeting.find({
    $or: [
      { organizer: userId },
      { 'participants.user': userId }
    ],
    status: 'in_progress'
  }).populate('organizer', 'firstName lastName')
    .populate('participants.user', 'firstName lastName');

  res.json({
    success: true,
    data: {
      activeMeetings,
      activeRooms: Array.from(activeRooms.keys()).includes(userId)
    }
  });
});

// Get room participants
export const getRoomParticipants = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const userId = req.user.id;

  // Verify user has access to meeting
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    throw new NotFoundError('Meeting');
  }

  const hasAccess = meeting.organizer.toString() === userId ||
                   meeting.participants.some(p => p.user.toString() === userId);

  if (!hasAccess) {
    throw new ValidationError('Access denied');
  }

  const participants = Array.from(roomParticipants.get(meetingId) || []);
  const participantDetails = await User.find(
    { _id: { $in: participants } },
    'firstName lastName email profilePicture'
  );

  res.json({
    success: true,
    data: {
      participants: participantDetails,
      participantCount: participants.length,
      isActive: roomParticipants.has(meetingId)
    }
  });
});

// Generate meeting link
export const generateMeetingLink = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const userId = req.user.id;

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    throw new NotFoundError('Meeting');
  }

  // Check if user is organizer or participant
  const hasAccess = meeting.organizer.toString() === userId ||
                   meeting.participants.some(p => p.user.toString() === userId);

  if (!hasAccess) {
    throw new ValidationError('Access denied');
  }

  // Generate or return existing meeting link
  if (!meeting.meetingLink) {
    meeting.meetingLink = `https://nexus.com/meeting/${meetingId}_${Date.now()}`;
    await meeting.save();
  }

  res.json({
    success: true,
    data: {
      meetingLink: meeting.meetingLink,
      meetingId: meeting._id,
      title: meeting.title,
      startTime: meeting.startTime,
      endTime: meeting.endTime
    }
  });
});

// End meeting (organizer only)
export const endMeeting = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const userId = req.user.id;

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    throw new NotFoundError('Meeting');
  }

  // Check if user is organizer
  if (meeting.organizer.toString() !== userId) {
    throw new ValidationError('Only organizer can end the meeting');
  }

  // Update meeting status
  meeting.status = 'completed';
  await meeting.save();

  // Notify all participants in room
  if (roomParticipants.has(meetingId)) {
    // This would be handled by the socket.io server
    logger.info(`Meeting ended: ${meetingId} by organizer ${userId}`);
  }

  res.json({
    success: true,
    message: 'Meeting ended successfully'
  });
});

export default {
  handleSocketConnection,
  getActiveRooms,
  getRoomParticipants,
  generateMeetingLink,
  endMeeting
};
