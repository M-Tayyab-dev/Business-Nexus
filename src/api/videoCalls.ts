import { apiClient } from './client';

export const videoCallsApi = {
  // Get a list of currently active video rooms
  getActiveRooms: () => apiClient.get('/video-calls/active-rooms'),
  
  // Get the participants currently in a specific room
  getRoomParticipants: (meetingId: string) => apiClient.get(`/video-calls/rooms/${meetingId}/participants`),
  
  // Generate a distinct joining link required before opening sockets
  generateMeetingLink: (meetingId: string) => apiClient.post(`/video-calls/rooms/${meetingId}/link`),
  
  // Terminate a video meeting and kick users out
  endMeeting: (meetingId: string) => apiClient.post(`/video-calls/rooms/${meetingId}/end`),
};
