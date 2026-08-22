import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Video, 
  ShieldCheck, 
  Clock, 
  Calendar, 
  User, 
  X, 
  Mic, 
  Camera, 
  AlertCircle
} from 'lucide-react';
import api from '../services/api';

export interface PreJoinAppointmentInfo {
  id: string;
  doctorId?: string;
  doctorName?: string;
  patientId?: string;
  patientName?: string;
  appointmentDate?: string;
  timeSlot?: string;
  callerName?: string;
  isWaiting?: boolean;
}

interface PreJoinCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: PreJoinAppointmentInfo | null;
}

const PreJoinCallModal: React.FC<PreJoinCallModalProps> = ({
  isOpen,
  onClose,
  appointment,
}) => {
  const navigate = useNavigate();
  const [details, setDetails] = useState<PreJoinAppointmentInfo | null>(appointment);
  const [loading, setLoading] = useState(false);
  const [cameraChecked, setCameraChecked] = useState(true);
  const [micChecked, setMicChecked] = useState(true);

  useEffect(() => {
    if (appointment) {
      setDetails(appointment);
      // If some details like doctorName or timeSlot are missing, fetch them
      if (!appointment.doctorName && appointment.id) {
        setLoading(true);
        api.get(`/appointments/${appointment.id}`)
          .then((res) => {
            setDetails((prev) => ({
              ...prev,
              ...res.data,
            }));
          })
          .catch((err) => {
            console.error('Failed to load appointment info in pre-join modal:', err);
          })
          .finally(() => setLoading(false));
      }
    }
  }, [appointment]);

  if (!isOpen || !details) return null;

  const currentUserId = localStorage.getItem('userId');
  const isPatient = currentUserId === details.patientId;
  const otherPartyTitle = isPatient 
    ? (details.doctorName ? `Dr. ${details.doctorName}` : 'Doctor')
    : (details.patientName || 'Patient');

  const handleConfirmJoin = () => {
    onClose();
    navigate(`/consultation/${details.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 p-6 md:p-8">
        
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl">
            <Video className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white">
                Join Video Consultation
              </h2>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" /> Secure
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Review your readiness before entering the room
            </p>
          </div>
        </div>

        {/* Caller Waiting Notice */}
        {(details.isWaiting || details.callerName) && (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping mt-1.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-300">
                {details.callerName ? `${details.callerName} is waiting in the room` : `${otherPartyTitle} is currently waiting on the call`}
              </p>
              <p className="text-[11px] text-emerald-400/80 mt-0.5">
                The call will connect automatically once you confirm and enter.
              </p>
            </div>
          </div>
        )}

        {/* Consultation Details Card */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Consultation With</span>
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <User className="w-3.5 h-3.5 text-blue-400" />
              {otherPartyTitle}
            </div>
          </div>

          {details.appointmentDate && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <span className="text-xs text-slate-400 font-medium">Scheduled Date</span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {details.appointmentDate}
              </div>
            </div>
          )}

          {details.timeSlot && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <span className="text-xs text-slate-400 font-medium">Time Slot</span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {details.timeSlot}
              </div>
            </div>
          )}
        </div>

        {/* Readiness Checklist */}
        <div className="space-y-2.5 mb-6">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Pre-Call Checklist
          </p>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 hover:bg-slate-800/60 cursor-pointer transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">Camera Enabled</p>
                <p className="text-[10px] text-slate-400">Your camera will be initialized upon entering</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={cameraChecked}
              onChange={(e) => setCameraChecked(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700 h-4 w-4"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 hover:bg-slate-800/60 cursor-pointer transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">Microphone Ready</p>
                <p className="text-[10px] text-slate-400">Microphone will be unmuted on join</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={micChecked}
              onChange={(e) => setMicChecked(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700 h-4 w-4"
            />
          </label>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1 pt-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Make sure you are in a quiet, well-lit environment.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition-all text-center"
          >
            Cancel / Later
          </button>

          <button
            type="button"
            onClick={handleConfirmJoin}
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Video className="w-4 h-4" />
            Enter Room
          </button>
        </div>

      </div>
    </div>
  );
};

export default PreJoinCallModal;
