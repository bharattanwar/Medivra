import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../context/WebSocketContext';
import api from '../services/api';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  PhoneOff, 
  ArrowLeft, 
  Loader2, 
  User, 
  Shield, 
  MessageSquare,
  Volume2
} from 'lucide-react';

interface AppointmentDetails {
  id: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  patientName: string;
  appointmentDate: string;
  timeSlot: string;
  status: string;
}

const ConsultationRoom: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { client, isConnected, sendMessage } = useWebSocket();

  // State
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'loading' | 'waiting' | 'connecting' | 'connected' | 'disconnected'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [peerName, setPeerName] = useState<string>('Remote User');
  const [isDoctor, setIsDoctor] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);

  // WebRTC Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Fetch Appointment Details & Determine Roles
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await api.get(`/appointments/${appointmentId}`);
        const data = response.data;
        setAppointment(data);

        const currentUserId = localStorage.getItem('userId');
        if (currentUserId === data.patientId) {
          setIsDoctor(false);
          setPeerName(`Dr. ${data.doctorName}`);
        } else {
          setIsDoctor(true);
          setPeerName(data.patientName);
        }
      } catch (err) {
        console.error('Error fetching appointment details:', err);
        setErrorMsg('Failed to load appointment details. Please check the URL.');
        setConnectionStatus('disconnected');
      }
    };
    fetchDetails();
  }, [appointmentId]);

  // Request local Media Stream (Camera and Mic)
  useEffect(() => {
    const initLocalMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: true
        });

        localStreamRef.current = stream;
        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setConnectionStatus('waiting');
      } catch (err) {
        console.error('Error getting local media:', err);
        setErrorMsg('Camera and Microphone access are required for consultations. Please check your browser permissions.');
        setConnectionStatus('disconnected');
      }
    };

    initLocalMedia();

    return () => {
      cleanupMedia();
    };
  }, []);

  // Hook into WebSocket STOMP Signaling
  useEffect(() => {
    if (!client || !isConnected || !localStream || !appointmentId) return;

    // Send "JOIN" signal so existing peer knows we joined
    console.log('Sending JOIN signal for appointment:', appointmentId);
    sendMessage('/app/video.signal', {
      appointmentId,
      type: 'JOIN',
      payload: null
    });

    // Subscribe to video signals destined for us
    const subscription = client.subscribe('/user/queue/video.signal', (message) => {
      try {
        const signal = JSON.parse(message.body);
        if (signal.appointmentId !== appointmentId) return;

        console.log('Received signal:', signal.type);

        switch (signal.type) {
          case 'JOIN':
            // Existing client initiates connection when a new user joins
            handlePeerJoin();
            break;
          case 'OFFER':
            handleOffer(JSON.parse(signal.payload));
            break;
          case 'ANSWER':
            handleAnswer(JSON.parse(signal.payload));
            break;
          case 'CANDIDATE':
            handleCandidate(JSON.parse(signal.payload));
            break;
          case 'LEAVE':
            handlePeerLeave();
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('Error handling incoming WebRTC signal:', err);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [client, isConnected, localStream, appointmentId]);

  // Clean up media tracks and connections
  const cleanupMedia = () => {
    console.log('Cleaning up peer connection and media tracks...');
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
  };

  // Helper: Create RTCPeerConnection
  const createPeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);

    // Add local tracks to PeerConnection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && appointmentId) {
        sendMessage('/app/video.signal', {
          appointmentId,
          type: 'CANDIDATE',
          payload: JSON.stringify(event.candidate)
        });
      }
    };

    // Remote Track handler
    pc.ontrack = (event) => {
      console.log('Remote stream added:', event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setRemoteStream(event.streams[0]);
      setConnectionStatus('connected');
    };

    pc.onconnectionstatechange = () => {
      console.log('WebRTC connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectionStatus('disconnected');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // WebRTC Negotiator Handlers
  const handlePeerJoin = async () => {
    console.log('Peer joined! Initiating call (creating WebRTC offer)...');
    setConnectionStatus('connecting');

    const pc = createPeerConnection();

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (appointmentId) {
        sendMessage('/app/video.signal', {
          appointmentId,
          type: 'OFFER',
          payload: JSON.stringify(pc.localDescription)
        });
      }
    } catch (err) {
      console.error('Failed to create offer:', err);
    }
  };

  const handleOffer = async (offerSDP: RTCSessionDescriptionInit) => {
    console.log('Received WebRTC offer. Creating WebRTC answer...');
    setConnectionStatus('connecting');

    const pc = createPeerConnection();

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offerSDP));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (appointmentId) {
        sendMessage('/app/video.signal', {
          appointmentId,
          type: 'ANSWER',
          payload: JSON.stringify(pc.localDescription)
        });
      }
    } catch (err) {
      console.error('Failed to set offer or create answer:', err);
    }
  };

  const handleAnswer = async (answerSDP: RTCSessionDescriptionInit) => {
    console.log('Received WebRTC answer. Setting remote description...');
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answerSDP));
      } catch (err) {
        console.error('Failed to set remote answer description:', err);
      }
    }
  };

  const handleCandidate = async (candidateData: RTCIceCandidateInit) => {
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidateData));
      } catch (err) {
        console.error('Failed to add remote ICE candidate:', err);
      }
    }
  };

  const handlePeerLeave = () => {
    console.log('Peer left consultation.');
    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setConnectionStatus('waiting');
  };

  // Toggle Controls
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Screen Sharing Logic
  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current) {
      alert('You must be connected to a peer to share your screen.');
      return;
    }

    if (isScreenSharing) {
      // Stop screen sharing and restore webcam
      stopScreenSharing();
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace webcam video track with screen track in PeerConnection sender
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(sender => sender.track?.kind === 'video');

        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }

        // Render screen stream locally
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);

        // Listen for browser's native "Stop Sharing" overlay button click
        screenTrack.onended = () => {
          stopScreenSharing();
        };

      } catch (err) {
        console.error('Error starting screen share:', err);
      }
    }
  };

  const stopScreenSharing = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Restore webcam track in PeerConnection sender
    if (peerConnectionRef.current && localStreamRef.current) {
      const webcamTrack = localStreamRef.current.getVideoTracks()[0];
      const senders = peerConnectionRef.current.getSenders();
      const videoSender = senders.find(sender => sender.track?.kind === 'video');

      if (videoSender && webcamTrack) {
        videoSender.replaceTrack(webcamTrack);
      }
    }

    // Restore local render to webcam stream
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    setIsScreenSharing(false);
  };

  const endCall = () => {
    if (window.confirm('Are you sure you want to end this video consultation?')) {
      if (appointmentId) {
        sendMessage('/app/video.signal', {
          appointmentId,
          type: 'LEAVE',
          payload: null
        });
      }
      cleanupMedia();
      setConnectionStatus('disconnected');
      navigate(isDoctor ? '/doctor/appointments' : '/patient/appointments');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden font-sans">
      
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-emerald-900/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Polish Grid Line Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Header bar */}
      <header className="z-10 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 hover:text-white transition-all duration-200"
            title="Go Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
                Medical Consultation Room
              </h1>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <Shield className="h-3 w-3" /> End-to-End Secure
              </span>
            </div>
            {appointment && (
              <p className="text-xs text-slate-400 mt-0.5">
                Appointment ID: <span className="font-mono text-slate-300">{appointment.id.substring(0, 8)}...</span> | Date: {appointment.appointmentDate} | Slot: {appointment.timeSlot}
              </p>
            )}
          </div>
        </div>

        {/* Connection Status Badge */}
        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-300">{peerName}</p>
            <p className="text-[10px] text-slate-500 font-medium">Consultation Peer</p>
          </div>
          <div className={`px-4 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all duration-300 ${
            connectionStatus === 'connected' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : connectionStatus === 'connecting'
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            <span className={`h-2 w-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-emerald-400' : connectionStatus === 'connecting' ? 'bg-blue-400' : 'bg-amber-400'
            }`} />
            {connectionStatus === 'connected' ? 'LIVE' : connectionStatus === 'connecting' ? 'CONNECTING...' : 'WAITING FOR PEER'}
          </div>
        </div>
      </header>

      {/* Main Grid View */}
      <main className="flex-1 flex flex-col lg:flex-row p-6 gap-6 relative z-10 overflow-hidden">
        
        {/* Stream viewports wrapper */}
        <div className="flex-1 flex flex-col justify-center items-center gap-6 relative rounded-3xl bg-slate-900/40 border border-slate-800/60 p-4 overflow-hidden">
          
          {errorMsg ? (
            <div className="max-w-md p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-center shadow-lg">
              <span className="text-4xl">⚠️</span>
              <h3 className="text-lg font-bold text-rose-400 mt-4">Media/Connection Error</h3>
              <p className="text-sm text-slate-400 mt-2">{errorMsg}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-6 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all"
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <div className="w-full h-full relative grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Local Stream view (Webcam) */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950/80 border border-slate-800/80 shadow-2xl flex items-center justify-center">
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover rounded-2xl ${isScreenSharing ? 'scale-x-100' : '-scale-x-100'}`}
                />
                
                {/* Local camera disabled placeholder */}
                {(!localStream || isVideoOff) && (
                  <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-slate-500">
                    <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center shadow-inner">
                      <User className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-400 mt-3">Your Camera is Off</p>
                  </div>
                )}

                {/* Local Overlay tag */}
                <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-200">You (Local)</span>
                  {isMuted && <MicOff className="h-3 w-3 text-rose-400" />}
                  {isScreenSharing && <Monitor className="h-3 w-3 text-blue-400" />}
                </div>
              </div>

              {/* Remote Stream view (Peer) */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950/80 border border-slate-800/80 shadow-2xl flex items-center justify-center">
                <video 
                  ref={remoteVideoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover rounded-2xl"
                />

                {/* Connecting / Waiting indicator */}
                {connectionStatus !== 'connected' && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6">
                    {connectionStatus === 'connecting' ? (
                      <>
                        <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                        <h4 className="text-base font-bold text-slate-200 mt-4">Connecting to peer...</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-[240px]">Negotiating secure WebRTC peer connection.</p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center shadow-md animate-pulse">
                          <User className="h-8 w-8 text-slate-500" />
                        </div>
                        <h4 className="text-base font-bold text-slate-300 mt-4">Waiting for {peerName}</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-[240px]">The call will connect automatically as soon as they join this consultation room.</p>
                      </>
                    )}
                  </div>
                )}

                {/* Remote Overlay tag */}
                {connectionStatus === 'connected' && (
                  <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-200">{peerName}</span>
                    <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Consultation Notes Sidebar Drawer (Optional placeholder for recruiters info / quick tips) */}
          {showChatDrawer && (
            <div className="absolute top-4 right-4 bottom-4 w-80 bg-slate-900/90 backdrop-blur-lg border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col z-20 animate-fade-in">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-400" /> Consultation Notes
                </h3>
                <button 
                  onClick={() => setShowChatDrawer(false)}
                  className="text-xs text-slate-500 hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 flex flex-col justify-center items-center text-center p-6 text-slate-500">
                <span className="text-3xl">📝</span>
                <p className="text-xs mt-3 font-semibold text-slate-400">Consultation Live Log</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Use this panel during the call to log medical insights. Notes are auto-saved to your patient record dashboard.</p>
              </div>
              <div className="pt-3 border-t border-slate-800">
                <textarea 
                  placeholder="Type advice or notes..." 
                  className="w-full h-20 bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-500/50 text-slate-300 resize-none"
                />
              </div>
            </div>
          )}

        </div>

      </main>

      {/* Floating Bottom Control Bar */}
      <footer className="z-10 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-4 pb-8 px-6 flex justify-center">
        
        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-5 md:gap-8 max-w-lg w-full justify-center">
          
          {/* Mute Microphone */}
          <button 
            onClick={toggleMute}
            className={`p-3.5 rounded-2xl transition-all duration-200 flex items-center justify-center ${
              isMuted 
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            disabled={connectionStatus === 'loading'}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {/* Toggle Camera */}
          <button 
            onClick={toggleVideo}
            className={`p-3.5 rounded-2xl transition-all duration-200 flex items-center justify-center ${
              isVideoOff 
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
            disabled={connectionStatus === 'loading'}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>

          {/* Share Screen */}
          <button 
            onClick={toggleScreenShare}
            className={`p-3.5 rounded-2xl transition-all duration-200 flex items-center justify-center ${
              isScreenSharing 
                ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
            disabled={connectionStatus !== 'connected'}
          >
            <Monitor className="h-5 w-5" />
          </button>

          {/* Toggle Notes Panel */}
          <button 
            onClick={() => setShowChatDrawer(!showChatDrawer)}
            className={`p-3.5 rounded-2xl transition-all duration-200 flex items-center justify-center ${
              showChatDrawer
                ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Toggle Notes Panel"
          >
            <MessageSquare className="h-5 w-5" />
          </button>

          {/* Divider */}
          <div className="h-8 w-[1px] bg-slate-800" />

          {/* End Call Button */}
          <button 
            onClick={endCall}
            className="p-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 hover:shadow-rose-500/30 active:scale-95 transition-all duration-150 flex items-center justify-center"
            title="End Video Consultation"
          >
            <PhoneOff className="h-5 w-5" />
          </button>

        </div>

      </footer>
    </div>
  );
};

export default ConsultationRoom;
