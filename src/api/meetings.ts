import { apiClient } from './client';

export interface MeetingOptions {
  title: string;
  description: string;
  participants: string[];
  startTime: string;
  endTime: string;
  timezone?: string;
  meetingType?: string;
  location?: string;
  agenda?: any[];
  isRecurring?: boolean;
  recurringPattern?: any;
}

export const meetingsApi = {
  // Scheduling a meeting (includes conflict detection via backend)
  createMeeting: (data: MeetingOptions) => apiClient.post('/meetings', data),
  
  // Get user's meetings (can sync with calendar on frontend)
  getMyMeetings: (params?: any) => apiClient.get('/meetings', { params }),
  
  // Get details of a single meeting
  getMeeting: (id: string) => apiClient.get(`/meetings/${id}`),
  
  // Update meeting properties like time or title
  updateMeeting: (id: string, data: Partial<MeetingOptions>) => apiClient.put(`/meetings/${id}`, data),
  
  // Accept / Reject meeting
  respondToMeeting: (id: string, response: 'accept' | 'decline' | 'tentative') => 
    apiClient.post(`/meetings/${id}/respond`, { response }),
    
  // Add or remove participants
  addParticipant: (id: string, userId: string) => apiClient.post(`/meetings/${id}/participants`, { userId }),
  removeParticipant: (id: string, participantId: string) => apiClient.delete(`/meetings/${id}/participants/${participantId}`),
  
  // Cancel meeting
  cancelMeeting: (id: string) => apiClient.delete(`/meetings/${id}`),
  
  // Explicit endpoint for detecting conflicts before saving
  getMeetingConflicts: (startTime: string, endTime: string, excludeMeetingId?: string) => 
    apiClient.get('/meetings/conflicts', { params: { startTime, endTime, excludeMeetingId } }),
    
  // Stats
  getMeetingStats: (params?: any) => apiClient.get('/meetings/stats', { params }),
};
