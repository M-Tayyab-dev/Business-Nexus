import React, { useEffect, useRef, useState } from 'react';
import { X, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import toast from 'react-hot-toast';

interface VideoCallModalProps {
  isOpen: boolean;
  meetingId: string | null;
  onClose: () => void;
  partnerName?: string;
  partnerAvatar?: string;
  isAudioOnly?: boolean;
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({ 
  isOpen, meetingId, onClose, partnerName, partnerAvatar, isAudioOnly 
}) => {
  const { user } = useAuth();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(isAudioOnly || false);
  const [isConnected, setIsConnected] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  // Initialize WebRTC and Socket
  useEffect(() => {
    if (!isOpen || !meetingId || !user) return;

    let localMediaStream: MediaStream;

    const startCall = async () => {
      // 1. Try to get local media (Optional fallback)
      try {
        localMediaStream = await navigator.mediaDevices.getUserMedia({
          video: !isAudioOnly,
          audio: true
        });
        setStream(localMediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localMediaStream;
        }
      } catch (mediaErr) {
        console.warn('Camera/Mic not found or blocked:', mediaErr);
        toast.error('No camera/mic found. Entering in view-only mode.');
      }

      try {
        // 2. Connect to Socket Signaling Server
        const socket = io(import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000', {
          auth: { userId: user.id, userName: user.name }
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('join-room', { meetingId, userName: user.name });
        });

        // 3. Setup WebRTC Peer Connection
        const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        const peer = new RTCPeerConnection(configuration);
        peerRef.current = peer;

        // Add local tracks to peer ONLY if media stream successfully loaded
        if (localMediaStream) {
          localMediaStream.getTracks().forEach(track => {
            peer.addTrack(track, localMediaStream);
          });
        }

        // Listen for remote tracks
        peer.ontrack = (event) => {
          setRemoteStream(event.streams[0]);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
          setIsConnected(true);
        };

        // ICE Candidate handling
        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice-candidate', { meetingId, candidate: event.candidate, targetUserId: 'broadcast' });
          }
        };

        // 4. Socket Events for Signaling
        socket.on('user-joined', async ({ userId, userName }) => {
          toast.success(`${userName} joined the call`);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket.emit('offer', { meetingId, targetUserId: userId, offer });
        });

        socket.on('offer', async ({ fromUserId, offer }) => {
          await peer.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit('answer', { meetingId, targetUserId: fromUserId, answer });
        });

        socket.on('answer', async ({ answer }) => {
          await peer.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.on('ice-candidate', async ({ candidate }) => {
          if (candidate) {
            try {
              await peer.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error('Error adding received ice candidate', e);
            }
          }
        });

        socket.on('user-left', () => {
          toast.error(`${partnerName || 'User'} left the call`);
          setRemoteStream(null);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          setIsConnected(false);
          handleEndCall(); // Optionally end completely if they leave
        });

      } catch (error) {
        console.error('Failed to start socket/Webrtc call:', error);
        toast.error('Network error during call initialization');
        handleEndCall();
      }
    };

    startCall();

    return () => {
      cleanupCall();
    };
  }, [isOpen, meetingId]);

  const cleanupCall = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (socketRef.current) {
      socketRef.current.emit('leave-room', { meetingId });
      socketRef.current.disconnect();
    }
    if (peerRef.current) {
      peerRef.current.close();
    }
    setStream(null);
    setRemoteStream(null);
    setIsConnected(false);
  };

  const handleEndCall = () => {
    cleanupCall();
    onClose();
  };

  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        socketRef.current?.emit('mute-audio', { meetingId, muted: !audioTrack.enabled });
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        socketRef.current?.emit('mute-video', { meetingId, muted: !videoTrack.enabled });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-gray-900 rounded-2xl overflow-hidden shadow-2xl relative">
        
        {/* Header */}
        <div className="absolute top-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-gray-900/80 to-transparent">
          <div className="flex items-center text-white">
            <Avatar src={partnerAvatar} alt={partnerName || 'Contact'} size="sm" className="mr-3" />
            <span className="font-medium mr-2">{isAudioOnly ? 'Voice Call' : 'Video Call'} with {partnerName || 'Contact'}</span>
            <span className="text-xs px-2 py-1 bg-gray-800 rounded-full text-gray-300">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
          <button onClick={handleEndCall} className="text-gray-300 hover:text-white bg-gray-800 rounded-full p-1.5 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Video Grid */}
        <div className="relative h-[60vh] md:h-[70vh] w-full flex items-center justify-center bg-gray-950">
          
          {/* Remote Video */}
          {(!remoteStream && isAudioOnly) || (!remoteStream) ? (
            <div className="flex flex-col items-center animate-pulse">
              <Avatar src={partnerAvatar} alt={partnerName || 'Contact'} size="lg" className="h-32 w-32 mb-4 ring-4 ring-gray-800" />
              <p className="text-gray-400 text-lg">Waiting for {partnerName || 'Contact'} to join...</p>
            </div>
          ) : (
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className={`w-full h-full object-cover ${isAudioOnly ? 'hidden' : ''}`}
            />
          )}

          {/* Local Video Thumbnail */}
          <div className={`absolute bottom-6 right-6 w-32 sm:w-48 aspect-video bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700 shadow-xl transition-all ${isAudioOnly ? 'hidden' : ''}`}>
             <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover transform -scale-x-100"
            />
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-900 p-6 flex justify-center items-center space-x-6 border-t border-gray-800">
          <Button 
            variant="ghost" 
            onClick={toggleMute}
            className={`rounded-full h-14 w-14 flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </Button>

          {!isAudioOnly && (
            <Button 
              variant="ghost" 
              onClick={toggleVideo}
              className={`rounded-full h-14 w-14 flex items-center justify-center transition-colors ${isVideoOff ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
            >
              {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
            </Button>
          )}

          <Button 
            variant="primary" 
            onClick={handleEndCall}
            className="rounded-full h-14 px-8 bg-red-600 hover:bg-red-700 text-white font-medium flex items-center shadow-lg shadow-red-600/20 transition-all border-0 ring-0"
          >
            <PhoneOff size={22} className="mr-2" />
            End Call
          </Button>
        </div>
      </div>
    </div>
  );
};
