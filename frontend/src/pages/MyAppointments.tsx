import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { processConsultationPayment } from '../components/PaymentCheckout';
import ChatWindow from '../components/chat/ChatWindow';
import CancelReasonModal from '../components/CancelReasonModal';
import RescheduleModal from '../components/RescheduleModal';

interface Appointment {
  id: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  timeSlot: string;
  status: string;
  createdAt: string;
  cancellationReason?: string;
  cancelledBy?: string;
  rescheduledFromId?: string;
  consultationType?: 'ONLINE' | 'IN_CLINIC';
}

const MyAppointments: React.FC = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<{ conversationId: string, doctorName: string, doctorId: string } | null>(null);

  // Modal states
  const [cancelModalApt, setCancelModalApt] = useState<{ id: string } | null>(null);
  const [rescheduleModalApt, setRescheduleModalApt] = useState<{ id: string; doctorId: string; doctorName: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) return;

      const response = await api.get(`/appointments/patient/${userId}`);
      setAppointments(response.data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPrescription = async (appointmentId: string) => {
    try {
      const response = await api.get(`/records/appointment/${appointmentId}`);
      if (response.data) {
        const { filePath } = response.data;

        const fileResponse = await api.get(`/records/view/${filePath}`, {
          responseType: 'blob'
        });

        const fileURL = URL.createObjectURL(fileResponse.data);
        window.open(fileURL, '_blank');

        setTimeout(() => URL.revokeObjectURL(fileURL), 1000 * 60);
      } else {
        alert('No prescription found for this appointment.');
      }
    } catch (error) {
      console.error('Error fetching prescription:', error);
      alert('Could not retrieve prescription.');
    }
  };

  const handlePayNow = async (apt: Appointment) => {
    const patientId = localStorage.getItem('userId');
    if (!patientId) return;

    setPayingId(apt.id);
    try {
      const doctorRes = await api.get(`/doctors/${apt.doctorId}`);
      const doctorData = doctorRes.data.data ?? doctorRes.data;
      const fee = doctorData.consultationFee ?? 500;

      await processConsultationPayment({
        appointmentId: apt.id,
        patientId,
        doctorName: apt.doctorName,
        amount: fee,
        onSuccess: () => {
          setSuccessMessage('Payment successful! Your appointment is confirmed.');
          fetchAppointments();
          setTimeout(() => setSuccessMessage(''), 3000);
        },
        onError: (msg) => alert(msg),
      });
    } catch (err) {
      console.error('Error initiating payment:', err);
    } finally {
      setPayingId(null);
    }
  };

  const handleStartConsultation = async (apt: Appointment) => {
    try {
      const res = await api.get(`/chat/appointment/${apt.id}`);
      if (res.data && res.data.id) {
        setActiveChat({
          conversationId: res.data.id,
          doctorName: apt.doctorName,
          doctorId: res.data.doctorId
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
        return 'bg-green-50 text-green-700 border-green-200';
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'CANCELLED':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'REJECTED':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'RESCHEDULED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'PENDING_RESCHEDULE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'COMPLETED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'IN_PROGRESS':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const patientUserId = localStorage.getItem('userId');

  const getLocalTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isCancelable = (dateStr: string) => {
    return dateStr > getLocalTodayString();
  };

  const isAppointmentElapsed = (dateStr: string, timeStr: string) => {
    if (!dateStr) return false;
    const today = getLocalTodayString();
    if (dateStr < today) return true;
    if (dateStr > today) return false;

    // Same day, check time.
    if (!timeStr) return false;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return false;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    const now = new Date();
    if (now.getHours() > hours) return true;
    if (now.getHours() === hours && now.getMinutes() > minutes) return true;

    return false;
  };


  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Appointments History</h1>
            <p className="text-gray-500 mt-1">Manage your upcoming and past medical consultations.</p>
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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                      🩺
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Dr. {apt.doctorName}</h3>
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

                  <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    {apt.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handlePayNow(apt)}
                          disabled={payingId === apt.id}
                          className="flex-1 md:flex-initial bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-blue-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
                        >
                          {payingId === apt.id ? 'Processing...' : '💳 Pay Now'}
                        </button>
                        {isCancelable(apt.appointmentDate) && (
                          <>
                            <button
                              onClick={() => setRescheduleModalApt({ id: apt.id, doctorId: apt.doctorId, doctorName: apt.doctorName })}
                              className="flex-1 md:flex-initial bg-white border border-blue-200 text-blue-600 px-4 py-2 rounded-xl font-semibold hover:bg-blue-50 transition-all text-xs"
                            >
                              📅 Reschedule
                            </button>
                            <button
                              onClick={() => setCancelModalApt({ id: apt.id })}
                              className="flex-1 md:flex-initial bg-white border border-red-200 text-red-600 px-4 py-2 rounded-xl font-semibold hover:bg-red-50 transition-all text-xs"
                            >
                              🚫 Cancel Request
                            </button>
                          </>
                        )}
                      </>
                    )}
                    {apt.status === 'CONFIRMED' && (
                      <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                        <button
                          onClick={() => handleViewPrescription(apt.id)}
                          className="flex-1 md:flex-initial bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-xl font-semibold hover:bg-indigo-50 transition-all text-xs"
                        >
                          📄 View Prescription
                        </button>
                        
                        {!isAppointmentElapsed(apt.appointmentDate, apt.timeSlot) && (
                          <>
                            <button
                              onClick={() => handleStartConsultation(apt)}
                              className="flex-1 md:flex-initial bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-green-700 transition-all shadow-md active:scale-95"
                            >
                              💬 Chat
                            </button>
                            {apt.consultationType !== 'IN_CLINIC' && (
                              <button
                                onClick={() => navigate(`/consultation/${apt.id}`)}
                                className="flex-1 md:flex-initial bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-blue-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-1"
                              >
                                📹 Join Call
                              </button>
                            )}
                            {isCancelable(apt.appointmentDate) && (
                              <>
                                <button
                                  onClick={() => setRescheduleModalApt({ id: apt.id, doctorId: apt.doctorId, doctorName: apt.doctorName })}
                                  className="flex-1 md:flex-initial bg-white border border-blue-200 text-blue-600 px-4 py-2 rounded-xl font-semibold hover:bg-blue-50 transition-all text-xs"
                                >
                                  📅 Reschedule
                                </button>
                                <button
                                  onClick={() => setCancelModalApt({ id: apt.id })}
                                  className="flex-1 md:flex-initial bg-white border border-red-200 text-red-600 px-4 py-2 rounded-xl font-semibold hover:bg-red-50 transition-all text-xs"
                                >
                                  🚫 Cancel
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {apt.status === 'PENDING_RESCHEDULE' && (
                      <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                        {apt.cancelledBy !== patientUserId ? (
                          <>
                            <button
                              onClick={() => handleAcceptReschedule(apt.id)}
                              className="flex-1 md:flex-initial bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-green-700 transition-all shadow-md active:scale-95"
                            >
                              ✅ Accept Reschedule
                            </button>
                            <button
                              onClick={() => handleRejectReschedule(apt.id)}
                              className="flex-1 md:flex-initial bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-red-700 transition-all shadow-md active:scale-95"
                            >
                              ❌ Reject Reschedule
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                            ⏳ Waiting for Doctor's Approval
                          </span>
                        )}
                      </div>
                    )}
                    {(apt.status === 'CANCELLED' || apt.status === 'REJECTED') && (
                      <button
                        onClick={() => navigate('/patient/dashboard')}
                        className="flex-1 md:flex-initial bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 px-4 py-2 rounded-xl font-bold text-xs transition-all"
                      >
                        🔄 Rebook Consultation
                      </button>
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
                        Action by: {apt.cancelledBy === patientUserId ? 'You' : 'Doctor'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <div className="text-6xl mb-4">🗓️</div>
            <h3 className="text-xl font-bold text-gray-900">No appointments yet</h3>
            <p className="text-gray-500 mt-2">You haven't booked any medical consultations yet.</p>
            <button
              onClick={() => navigate('/patient/dashboard')}
              className="mt-6 bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md"
            >
              Book Now
            </button>
          </div>
        )}
      </div>

      {activeChat && (
        <ChatWindow
          conversationId={activeChat.conversationId}
          otherPartyName={`Dr. ${activeChat.doctorName}`}
          otherPartyId={activeChat.doctorId}
          onClose={() => setActiveChat(null)}
        />
      )}

      {cancelModalApt && (
        <CancelReasonModal
          appointmentId={cancelModalApt.id}
          mode="cancel"
          onClose={() => setCancelModalApt(null)}
          onSuccess={() => {
            setCancelModalApt(null);
            setSuccessMessage('Appointment request cancelled successfully.');
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
            setSuccessMessage('Appointment rescheduled successfully.');
            fetchAppointments();
            setTimeout(() => setSuccessMessage(''), 3000);
          }}
        />
      )}
    </div>
  );
};

export default MyAppointments;
