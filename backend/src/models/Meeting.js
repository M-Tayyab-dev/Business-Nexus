import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Meeting title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: ''
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Organizer is required']
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending'
    },
    respondedAt: {
      type: Date
    }
  }],
  startTime: {
    type: Date,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: Date,
    required: [true, 'End time is required']
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  meetingType: {
    type: String,
    enum: ['video', 'audio', 'in_person'],
    default: 'video'
  },
  meetingLink: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  agenda: [{
    item: String,
    duration: Number // in minutes
  }],
  notes: {
    type: String,
    default: ''
  },
  recording: {
    url: String,
    duration: Number,
    recordedAt: Date
  },
  followUpActions: [{
    action: String,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    dueDate: Date,
    completed: {
      type: Boolean,
      default: false
    }
  }],
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    interval: Number,
    endDate: Date,
    daysOfWeek: [Number], // 0-6 (Sunday-Saturday)
    dayOfMonth: Number
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for meeting duration
meetingSchema.virtual('duration').get(function() {
  if (this.endTime && this.startTime) {
    return Math.round((this.endTime - this.startTime) / (1000 * 60)); // in minutes
  }
  return 0;
});

// Virtual for meeting status based on time
meetingSchema.virtual('timeStatus').get(function() {
  const now = new Date();
  if (this.status === 'cancelled') return 'cancelled';
  if (this.status === 'completed') return 'completed';
  if (now < this.startTime) return 'upcoming';
  if (now >= this.startTime && now <= this.endTime) return 'ongoing';
  return 'past';
});

// Indexes for efficient querying
meetingSchema.index({ organizer: 1, startTime: 1 });
meetingSchema.index({ 'participants.user': 1, startTime: 1 });
meetingSchema.index({ startTime: 1, endTime: 1 });
meetingSchema.index({ status: 1 });

// Pre-save validation to ensure end time is after start time
meetingSchema.pre('save', function(next) {
  if (this.endTime <= this.startTime) {
    return next(new Error('End time must be after start time'));
  }
  next();
});

// Static method to check for conflicts
meetingSchema.statics.checkConflicts = async function(userId, startTime, endTime, excludeMeetingId = null) {
  const query = {
    $or: [
      { organizer: userId },
      { 'participants.user': userId }
    ],
    status: { $in: ['scheduled', 'in_progress'] },
    $and: [
      { startTime: { $lt: endTime } },
      { endTime: { $gt: startTime } }
    ]
  };

  if (excludeMeetingId) {
    query._id = { $ne: excludeMeetingId };
  }

  const conflicts = await this.find(query);
  return conflicts;
};

// Method to add participant
meetingSchema.methods.addParticipant = function(userId) {
  const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
  if (!existingParticipant) {
    this.participants.push({
      user: userId,
      status: 'pending'
    });
  }
  return this.save();
};

// Method to update participant response
meetingSchema.methods.updateParticipantResponse = function(userId, response) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (participant) {
    participant.status = response;
    participant.respondedAt = new Date();
  }
  return this.save();
};

export default mongoose.model('Meeting', meetingSchema);
