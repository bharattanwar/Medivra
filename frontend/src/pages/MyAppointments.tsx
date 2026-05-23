import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { processConsultationPayment } from '../components/PaymentCheckout';
import ChatWindow from '../components/chat/ChatWindow';

interface Appointment {
  id: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  timeSlot: string;
  status: string;
  createdAt: string;
}

const MyAppointments: React.FC = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<{ conversationId: string, doctorName: string, doctorId: string } | null>(null);

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
        onSuccess: () => fetchAppointments(),
        onError: (msg) => alert(msg),
      });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-100 text-green-700 border-green-200';
      case 'PENDING': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'CANCELLED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">My Appointments</h1>
            <p className="text-gray-500 mt-1">Manage your upcoming and past medical consultations.</p>
          </div>
          <button 
            onClick={fetchAppointments}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
            title="Refresh"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
          </div>
        ) : appointments.length > 0 ? (
          <div className="grid gap-6">
            {appointments.map((apt) => (
              <div key={apt.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl">
                    🩺
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Dr. {apt.doctorName}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        📅 {new Date(apt.appointmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1">
                        ⏰ {apt.timeSlot}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${getStatusColor(apt.status)}`}>
                    {apt.status}
                  </span>
                  {apt.status === 'PENDING' && (
                    <button
                      onClick={() => handlePayNow(apt)}
                      disabled={payingId === apt.id}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {payingId === apt.id ? 'Processing...' : 'Pay Now'}
                    </button>
                  )}
                  {apt.status === 'CONFIRMED' && (
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => handleViewPrescription(apt.id)}
                        className="text-blue-600 font-bold text-sm hover:underline"
                      >
                        View Prescription
                      </button>
                      <button
                        onClick={() => handleStartConsultation(apt)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700 w-full"
                      >
                        💬 Start Consultation
                      </button>
                      <button
                        onClick={() => navigate(`/consultation/${apt.id}`)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 w-full flex items-center justify-center gap-1.5"
                      >
                        📹 Join Video Call
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <div className="text-6xl mb-4">🗓️</div>
            <h3 className="text-xl font-bold text-gray-900">No appointments yet</h3>
            <p className="text-gray-500 mt-2">You haven't booked any medical consultations yet.</p>
            <button 
              onClick={() => window.history.back()}
              className="mt-6 bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all"
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
    </div>
  );
};

export default MyAppointments;
