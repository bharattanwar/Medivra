import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import UploadPrescriptionModal from '../components/UploadPrescriptionModal';
import ChatWindow from '../components/chat/ChatWindow';
import CancelReasonModal from '../components/CancelReasonModal';
import RescheduleModal from '../components/RescheduleModal';
import { isAppointmentElapsed, isCancelable } from '../utils/appointmentUtils';

interface Appointment {
  id: string;
  patientName: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  timeSlot: string;
  status: string;
  hasPrescription?: boolean;
  cancellationReason?: string;
  cancelledBy?: string;
  rescheduledFromId?: string;
  consultationType?: 'ONLINE' | 'IN_CLINIC';
}

const DoctorAppointments: React.FC = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeChat, setActiveChat] = useState<{ conversationId: string, patientName: string, patientId: string } | null>(null);

  // Modal states
  const [cancelModalApt, setCancelModalApt] = useState<{ id: string; mode: 'cancel' | 'reject' } | null>(null);
  const [rescheduleModalApt, setRescheduleModalApt] = useState<{ id: string; doctorId: string; doctorName: string } | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const doctorUserId = localStorage.getItem('userId');
      if (!doctorUserId) return;

      // Fetch appointments by doctor's user ID directly
      const response = await api.get(`/appointments/doctor/userId/${doctorUserId}`); 
      setAppointments(response.data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    setSelectedAppointment(null);
    setSuccessMessage('Prescription uploaded successfully!');
    fetchAppointments();
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleStartConsultation = async (apt: Appointment) => {
    try {
      const res = await api.get(`/chat/appointment/${apt.id}`);
      if (res.data && res.data.id) {
        setActiveChat({
          conversationId: res.data.id,
          patientName: apt.patientName,
          patientId: res.data.patientId
        });
      }
    } catch (error) {
      console.error('Failed to start consultation', error);
      alert('Could not start consultation. Has the chat been initialized?');
    }
  };

  const handleAcceptReschedule = async (appointmentId: string) => {
    try {
      await api.put(`/appointments/${appointmentId}/reschedule/accept`);
      setSuccessMessage('Reschedule request accepted successfully.');
      fetchAppointments();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Error accepting reschedule:', error);
      alert(error.response?.data?.message || 'Failed to accept reschedule.');
    }
  };

  const handleRejectReschedule = async (appointmentId: string) => {
    try {
      await api.put(`/appointments/${appointmentId}/reschedule/reject`);
      setSuccessMessage('Reschedule request rejected. Refund initiated if applicable.');
      fetchAppointments();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Error rejecting reschedule:', error);
      alert(error.response?.data?.message || 'Failed to reject reschedule.');
    }
  };


  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-50 text-green-600 border-green-100';
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-600 border-yellow-100';
      case 'CANCELLED':
        return 'bg-red-50 text-red-600 border-red-100';
      case 'REJECTED':
        return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'RESCHEDULED':
        return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'PENDING_RESCHEDULE':
        return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'COMPLETED':
        return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'IN_PROGRESS':
        return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const doctorUserId = localStorage.getItem('userId');

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Patient Consultations</h1>
            <p className="text-gray-500 mt-1">Manage your appointments and provide prescriptions.</p>
          </div>
          <button 
            onClick={fetchAppointments}
            className="p-2.5 bg-white rounded-full border border-gray-200 hover:bg-gray-50 shadow-sm transition-all"
            title="Refresh"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {successMessage && (
          <div className="mb-6 bg-green-100 text-green-700 p-4 rounded-2xl font-bold animate-fade-in text-center shadow-sm">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
          </div>
        ) : appointments.length > 0 ? (
          <div className="grid gap-6">
            {appointments.map((apt) => (
              <div key={apt.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl shrink-0">
                      👤
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{apt.patientName}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-xs font-medium text-gray-600">
                          📅 {new Date(apt.appointmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-xs font-medium text-gray-600">
                          ⏰ {apt.timeSlot}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(apt.status)}`}>
                          {apt.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {apt.status === 'CONFIRMED' && (
                      <>
                        {!isAppointmentElapsed(apt.appointmentDate, apt.timeSlot) ? (
                          <>
                            <button 
                              onClick={() => handleStartConsultation(apt)}
                              className="flex-1 lg:flex-initial h-9 bg-green-600 hover:bg-green-700 text-white px-4 rounded-xl font-semibold transition-all shadow-md active:scale-95 flex items-center justify-center text-xs gap-1.5"
                            >
                              💬 Start Consultation
                            </button>
                            {apt.consultationType !== 'IN_CLINIC' && (
                              <button 
                                onClick={() => navigate(`/consultation/${apt.id}`)}
                                className="flex-1 lg:flex-initial h-9 bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl font-semibold transition-all shadow-md active:scale-95 flex items-center justify-center text-xs gap-1.5"
                              >
                                📹 Join Video Call
                              </button>
                            )}
                            <button 
                              onClick={() => setSelectedAppointment(apt)}
                              className="flex-1 lg:flex-initial h-9 bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-xl font-semibold transition-all shadow-md active:scale-95 flex items-center justify-center text-xs gap-1.5"
                            >
                              📤 Upload Prescription
                            </button>
                            {isCancelable(apt.appointmentDate) && (
                              <>
                                <button 
                                  onClick={() => setRescheduleModalApt({ id: apt.id, doctorId: apt.doctorId, doctorName: apt.doctorName })}
                                  className="flex-1 lg:flex-initial h-9 bg-white border border-blue-200 text-blue-600 px-4 rounded-xl font-semibold hover:bg-blue-50 transition-all flex items-center justify-center text-xs gap-1"
                                >
                                  📅 Reschedule
                                </button>
                                <button 
                                  onClick={() => setCancelModalApt({ id: apt.id, mode: 'cancel' })}
                                  className="flex-1 lg:flex-initial h-9 bg-white border border-red-200 text-red-600 px-4 rounded-xl font-semibold hover:bg-red-50 transition-all flex items-center justify-center text-xs gap-1"
                                >
                                  🚫 Cancel
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => setSelectedAppointment(apt)}
                              className="flex-1 lg:flex-initial h-9 bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-xl font-semibold transition-all shadow-md active:scale-95 flex items-center justify-center text-xs gap-1.5"
                            >
                              📤 Upload Prescription
                            </button>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                              ⏰ Slot Elapsed
                            </span>
                          </>
                        )}
                      </>
                    )}

                    {apt.status === 'PENDING' && (
                      <>
                        {!isAppointmentElapsed(apt.appointmentDate, apt.timeSlot) && isCancelable(apt.appointmentDate) && (
                          <button 
                            onClick={() => setRescheduleModalApt({ id: apt.id, doctorId: apt.doctorId, doctorName: apt.doctorName })}
                            className="flex-1 lg:flex-initial h-9 bg-white border border-blue-200 text-blue-600 px-4 rounded-xl font-semibold hover:bg-blue-50 transition-all flex items-center justify-center text-xs gap-1"
                          >
                            📅 Reschedule
                          </button>
                        )}
                        <button 
                          onClick={() => setCancelModalApt({ id: apt.id, mode: 'reject' })}
                          className="flex-1 lg:flex-initial h-9 bg-white border border-orange-200 text-orange-600 px-4 rounded-xl font-semibold hover:bg-orange-50 transition-all flex items-center justify-center text-xs gap-1"
                        >
                          ❌ Reject Request
                        </button>
                      </>
                    )}
                     {apt.status === 'PENDING_RESCHEDULE' && (
                      <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                        {apt.cancelledBy !== doctorUserId ? (
                          <>
                            <button
                              onClick={() => handleAcceptReschedule(apt.id)}
                              className="flex-1 lg:flex-initial h-9 bg-green-600 hover:bg-green-700 text-white px-4 rounded-xl font-semibold transition-all shadow-md active:scale-95 flex items-center justify-center text-xs gap-1.5"
                            >
                              ✅ Accept Reschedule
                            </button>
                            <button
                              onClick={() => handleRejectReschedule(apt.id)}
                              className="flex-1 lg:flex-initial h-9 bg-red-600 hover:bg-red-700 text-white px-4 rounded-xl font-semibold transition-all shadow-md active:scale-95 flex items-center justify-center text-xs gap-1.5"
                            >
                              ❌ Reject Reschedule
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                            ⏳ Waiting for Patient's Approval
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cancellation / Rejection / Rescheduled reason details */}
                {(apt.status === 'CANCELLED' || apt.status === 'REJECTED' || apt.status === 'RESCHEDULED' || apt.status === 'PENDING_RESCHEDULE') && apt.cancellationReason && (
                  <div className="border-t pt-3 mt-1 border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div className="text-sm">
                      <span className="font-bold text-gray-700">
                        {(apt.status === 'RESCHEDULED' || apt.status === 'PENDING_RESCHEDULE') ? 'Rescheduled Reason: ' : 'Reason: '}
                      </span>
                      <span className="text-gray-600 italic">"{apt.cancellationReason}"</span>
                    </div>
                    {apt.cancelledBy && (
                      <span className="text-xs text-gray-400 font-medium bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100 self-start sm:self-auto shrink-0">
                        Action by: {apt.cancelledBy === doctorUserId ? 'You' : 'Patient'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <div className="text-6xl mb-4">🩺</div>
            <h3 className="text-xl font-bold text-gray-900">No appointments scheduled</h3>
            <p className="text-gray-500 mt-2">When patients book slots, they will appear here.</p>
          </div>
        )}

        {selectedAppointment && (
          <UploadPrescriptionModal
            appointmentId={selectedAppointment.id}
            patientId={selectedAppointment.patientId}
            doctorId={selectedAppointment.doctorId}
            onClose={() => setSelectedAppointment(null)}
            onSuccess={handleUploadSuccess}
          />
        )}

        {activeChat && (
          <ChatWindow 
            conversationId={activeChat.conversationId}
            otherPartyName={activeChat.patientName}
            otherPartyId={activeChat.patientId}
            onClose={() => setActiveChat(null)}
          />
        )}

        {cancelModalApt && (
          <CancelReasonModal
            appointmentId={cancelModalApt.id}
            mode={cancelModalApt.mode}
            onClose={() => setCancelModalApt(null)}
            onSuccess={() => {
              setCancelModalApt(null);
              setSuccessMessage(`Appointment successfully ${cancelModalApt.mode}ed!`);
              fetchAppointments();
              setTimeout(() => setSuccessMessage(''), 3000);
            }}
          />
        )}

        {rescheduleModalApt && (
          <RescheduleModal
            appointmentId={rescheduleModalApt.id}
            doctorId={rescheduleModalApt.doctorId}
            doctorName={rescheduleModalApt.doctorName}
            onClose={() => setRescheduleModalApt(null)}
            onSuccess={() => {
              setRescheduleModalApt(null);
              setSuccessMessage('Appointment successfully rescheduled!');
              fetchAppointments();
              setTimeout(() => setSuccessMessage(''), 3000);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default DoctorAppointments;
