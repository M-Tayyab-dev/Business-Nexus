import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import toast from 'react-hot-toast';
import { meetingsApi } from '../../api/meetings';
import { useAuth } from '../../context/AuthContext';

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerId: string;
  partnerName: string;
}

export const ScheduleMeetingModal: React.FC<ScheduleMeetingModalProps> = ({ 
  isOpen, onClose, partnerId, partnerName 
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState(`Introductory Meeting with ${user?.name}`);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState('');

  const checkConflicts = async (start: string, end: string) => {
    try {
      const res = await meetingsApi.getMeetingConflicts(start, end);
      if (res.data?.data?.hasConflicts) {
        setConflictWarning('Warning: You have a scheduling conflict at this time.');
      } else {
        setConflictWarning('');
      }
    } catch {
      setConflictWarning('');
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTime(e.target.value);
    if (date && e.target.value) {
      const start = new Date(`${date}T${e.target.value}`).toISOString();
      const end = new Date(new Date(start).getTime() + parseInt(duration) * 60000).toISOString();
      checkConflicts(start, end);
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) {
      toast.error('Please select a valid date and time');
      return;
    }

    setIsSubmitting(true);
    try {
      const startTime = new Date(`${date}T${time}`).toISOString();
      const endTime = new Date(new Date(startTime).getTime() + parseInt(duration) * 60000).toISOString();
      
      await meetingsApi.createMeeting({
        title,
        description: 'Scheduled via Nexus Platform',
        participants: [partnerId],
        startTime,
        endTime,
        meetingType: 'video'
      });
      
      toast.success('Meeting scheduled successfully! It has been added to your calendar.');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to schedule meeting. Conflict detected or backend unavailable.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <CalendarIcon className="mr-2 text-primary-600" size={24} />
            Schedule Meeting
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSchedule} className="p-6 space-y-5">
          <p className="text-gray-600 text-sm">
            Schedule a virtual meeting with <span className="font-semibold text-gray-900">{partnerName}</span>. 
            Once scheduled, both parties will receive a notification and calendar sync.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title</label>
            <Input 
              type="text" 
              fullWidth 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <div className="relative">
                <Input 
                  type="date" 
                  fullWidth 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <div className="relative">
                <Input 
                  type="time" 
                  fullWidth 
                  value={time}
                  onChange={handleTimeChange}
                  required
                />
                <Clock className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
            <select 
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              <option value="15">15 Minutes</option>
              <option value="30">30 Minutes</option>
              <option value="60">1 Hour</option>
              <option value="90">1.5 Hours</option>
            </select>
          </div>

          {conflictWarning && (
            <div className="p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm flex items-start">
              <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
              {conflictWarning}
            </div>
          )}

          <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting || !date || !time}>
              {isSubmitting ? 'Scheduling...' : 'Confirm Schedule'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
