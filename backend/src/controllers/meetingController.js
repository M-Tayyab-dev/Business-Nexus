import Meeting from '../models/Meeting.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import { sendMeetingInvitation } from '../services/emailService.js';
import { asyncHandler, NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler.js';

// Create meeting
export const createMeeting = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    participants,
    startTime,
    endTime,
    timezone,
    meetingType,
    location,
    agenda,
    isRecurring,
    recurringPattern
  } = req.body;

  const organizerId = req.user.id;

  // Validate participants exist
  const validParticipants = await User.find({ 
    _id: { $in: participants },
    isActive: true
  });

  if (validParticipants.length !== participants.length) {
    throw new ValidationError('Some participants are invalid or inactive');
  }

  // Check for conflicts for organizer and all participants
  const conflictCheck = await Meeting.checkConflicts(organizerId, new Date(startTime), new Date(endTime));
  if (conflictCheck.length > 0) {
    throw new ConflictError('You have a scheduling conflict at the requested time');
  }

  // Check conflicts for each participant
  for (const participantId of participants) {
    const participantConflicts = await Meeting.checkConflicts(participantId, new Date(startTime), new Date(endTime));
    if (participantConflicts.length > 0) {
      throw new ConflictError(`Participant has a scheduling conflict at the requested time`);
    }
  }

  // Create meeting
  const meeting = new Meeting({
    title,
    description,
    organizer: organizerId,
    participants: participants.map(p => ({ user: p, status: 'pending' })),
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    timezone: timezone || 'UTC',
    meetingType: meetingType || 'video',
    location: location || '',
    agenda: agenda || [],
    isRecurring: isRecurring || false,
    recurringPattern: isRecurring ? recurringPattern : undefined,
    meetingLink: `https://nexus.com/meeting/${Date.now()}`
  });

  await meeting.save();

  // Populate meeting data
  await meeting.populate([
    { path: 'organizer', select: 'firstName lastName email profilePicture' },
    { path: 'participants.user', select: 'firstName lastName email profilePicture' }
  ]);

  // Send email invitations
  try {
    for (const participant of meeting.participants) {
      await sendMeetingInvitation(meeting, participant.user);
    }
  } catch (emailError) {
    logger.error('Failed to send meeting invitations:', emailError);
  }

  logger.info(`Meeting created: ${meeting._id} by ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Meeting created successfully',
    data: { meeting }
  });
});

// Get meetings for current user
export const getMyMeetings = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    status, 
    startDate, 
    endDate,
    type 
  } = req.query;

  const userId = req.user.id;
  const skip = (page - 1) * limit;

  // Build query
  const query = {
    $or: [
      { organizer: userId },
      { 'participants.user': userId }
    ]
  };

  if (status) {
    query.status = status;
  }

  if (type) {
    query.meetingType = type;
  }

  if (startDate || endDate) {
    query.startTime = {};
    if (startDate) query.startTime.$gte = new Date(startDate);
    if (endDate) query.startTime.$lte = new Date(endDate);
  }

  const meetings = await Meeting.find(query)
    .populate('organizer', 'firstName lastName email profilePicture')
    .populate('participants.user', 'firstName lastName email profilePicture')
    .sort({ startTime: 1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Meeting.countDocuments(query);

  res.json({
    success: true,
    data: {
      meetings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get single meeting
export const getMeeting = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const meeting = await Meeting.findById(id)
    .populate('organizer', 'firstName lastName email profilePicture')
    .populate('participants.user', 'firstName lastName email profilePicture');

  if (!meeting) {
    throw new NotFoundError('Meeting');
  }

  // Check if user has access to this meeting
  const hasAccess = meeting.organizer._id.toString() === userId ||
                   meeting.participants.some(p => p.user._id.toString() === userId);

  if (!hasAccess) {
    throw new ValidationError('Access denied');
  }

  res.json({
    success: true,
    data: { meeting }
  });
});

// Update meeting
export const updateMeeting = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const updates = req.body;

  const meeting = await Meeting.findById(id);
  if (!meeting) {
    throw new NotFoundError('Meeting');
  }

  // Check if user is the organizer
  if (meeting.organizer.toString() !== userId) {
    throw new ValidationError('Only the organizer can update the meeting');
  }

  // Check if meeting can be updated (not completed or cancelled)
  if (['completed', 'cancelled'].includes(meeting.status)) {
    throw new ValidationError('Cannot update a completed or cancelled meeting');
  }

  // If time is being updated, check for conflicts
  if (updates.startTime || updates.endTime) {
    const newStartTime = updates.startTime ? new Date(updates.startTime) : meeting.startTime;
    const newEndTime = updates.endTime ? new Date(updates.endTime) : meeting.endTime;

    const conflicts = await Meeting.checkConflicts(userId, newStartTime, newEndTime, id);
    if (conflicts.length > 0) {
      throw new ConflictError('Scheduling conflict detected');
    }

    // Check participant conflicts
    for (const participant of meeting.participants) {
      const participantConflicts = await Meeting.checkConflicts(
        participant.user.toString(), 
        newStartTime, 
        newEndTime, 
        id
      );
      if (participantConflicts.length > 0) {
        throw new ConflictError(`Participant has a scheduling conflict`);
      }
    }
  }

  // Update meeting
  Object.keys(updates).forEach(key => {
    if (key === 'participants') return; // Handle participants separately
    meeting[key] = updates[key];
  });

  await meeting.save();

  await meeting.populate([
    { path: 'organizer', select: 'firstName lastName email profilePicture' },
    { path: 'participants.user', select: 'firstName lastName email profilePicture' }
  ]);

  logger.info(`Meeting updated: ${meeting._id} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Meeting updated successfully',
    data: { meeting }
  });
});

// Respond to meeting invitation
export const respondToMeeting = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { response } = req.body;
  const userId = req.user.id;

  const meeting = await Meeting.findById(id)
    .populate('organizer', 'firstName lastName email')
    .populate('participants.user', 'firstName lastName email');

  if (!meeting) {
    throw new NotFoundError('Meeting');
  }

  // Check if user is a participant
  const participant = meeting.participants.find(p => p.user._id.toString() === userId);
  if (!participant) {
    throw new ValidationError('You are not a participant in this meeting');
  }

  // Update participant response
  await meeting.updateParticipantResponse(userId, response);

  logger.info(`Meeting response: ${userId} ${response} meeting ${id}`);

  res.json({
    success: true,
    message: `Meeting ${response} successfully`
  });
});

// Add participant to meeting
export const addParticipant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId: participantId } = req.body;
  const organizerId = req.user.id;

  const meeting = await Meeting.findById(id);
  if (!meeting) {
    throw new NotFoundError('Meeting');
  }

  // Check if user is the organizer
  if (meeting.organizer.toString() !== organizerId) {
    throw new ValidationError('Only the organizer can add participants');
  }

  // Check if meeting can be updated
  if (['completed', 'cancelled'].includes(meeting.status)) {
    throw new ValidationError('Cannot add participants to a completed or cancelled meeting');
  }

  // Validate participant
  const participant = await User.findById(participantId);
  if (!participant || !participant.isActive) {
    throw new ValidationError('Invalid participant');
  }

  // Check for conflicts
  const conflicts = await Meeting.checkConflicts(participantId, meeting.startTime, meeting.endTime);
  if (conflicts.length > 0) {
    throw new ConflictError('Participant has a scheduling conflict');
  }

  // Add participant
  await meeting.addParticipant(participantId);

  // Send invitation
  try {
    await sendMeetingInvitation(meeting, participant);
  } catch (emailError) {
    logger.error('Failed to send meeting invitation:', emailError);
  }

  await meeting.populate([
    { path: 'organizer', select: 'firstName lastName email profilePicture' },
    { path: 'participants.user', select: 'firstName lastName email profilePicture' }
  ]);

  logger.info(`Participant added to meeting: ${participantId} to ${id}`);

  res.json({
    success: true,
    message: 'Participant added successfully',
    data: { meeting }
  });
});

// Remove participant from meeting
export const removeParticipant = asyncHandler(async (req, res) => {
  const { id, participantId } = req.params;
  const organizerId = req.user.id;

  const meeting = await Meeting.findById(id);
  if (!meeting) {
    throw new NotFoundError('Meeting');
  }

  // Check if user is the organizer or the participant themselves
  const isOrganizer = meeting.organizer.toString() === organizerId;
  const isParticipant = participantId === organizerId;

  if (!isOrganizer && !isParticipant) {
    throw new ValidationError('Access denied');
  }

  // Remove participant
  meeting.participants = meeting.participants.filter(
    p => p.user.toString() !== participantId
  );

  await meeting.save();

  await meeting.populate([
    { path: 'organizer', select: 'firstName lastName email profilePicture' },
    { path: 'participants.user', select: 'firstName lastName email profilePicture' }
  ]);

  logger.info(`Participant removed from meeting: ${participantId} from ${id}`);

  res.json({
    success: true,
    message: 'Participant removed successfully',
    data: { meeting }
  });
});

// Cancel meeting
export const cancelMeeting = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const meeting = await Meeting.findById(id);
  if (!meeting) {
    throw new NotFoundError('Meeting');
  }

  // Check if user is the organizer
  if (meeting.organizer.toString() !== userId) {
    throw new ValidationError('Only the organizer can cancel the meeting');
  }

  // Update meeting status
  meeting.status = 'cancelled';
  await meeting.save();

  // Send cancellation notifications
  try {
    const populatedMeeting = await Meeting.findById(id)
      .populate('participants.user', 'email firstName lastName');

    for (const participant of populatedMeeting.participants) {
      await sendMeetingInvitation({
        ...populatedMeeting.toObject(),
        title: `CANCELLED: ${populatedMeeting.title}`,
        description: 'This meeting has been cancelled by the organizer.'
      }, participant.user);
    }
  } catch (emailError) {
    logger.error('Failed to send cancellation notifications:', emailError);
  }

  logger.info(`Meeting cancelled: ${id} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Meeting cancelled successfully'
  });
});

// Get meeting conflicts
export const getMeetingConflicts = asyncHandler(async (req, res) => {
  const { startTime, endTime, excludeMeetingId } = req.query;
  const userId = req.user.id;

  if (!startTime || !endTime) {
    throw new ValidationError('Start time and end time are required');
  }

  const conflicts = await Meeting.checkConflicts(
    userId,
    new Date(startTime),
    new Date(endTime),
    excludeMeetingId
  );

  res.json({
    success: true,
    data: {
      conflicts,
      hasConflicts: conflicts.length > 0
    }
  });
});

// Get meeting statistics
export const getMeetingStats = asyncHandler(async (req, res) => {
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

  const stats = await Meeting.aggregate([
    {
      $match: {
        $or: [
          { organizer: userId },
          { 'participants.user': userId }
        ],
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalDuration: { $sum: { $subtract: ['$endTime', '$startTime'] } }
      }
    }
  ]);

  const totalMeetings = await Meeting.countDocuments({
    $or: [
      { organizer: userId },
      { 'participants.user': userId }
    ],
    createdAt: { $gte: startDate }
  });

  res.json({
    success: true,
    data: {
      stats,
      totalMeetings,
      period
    }
  });
});
