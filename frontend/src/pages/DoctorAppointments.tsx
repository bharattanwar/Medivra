import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import UploadPrescriptionModal from '../components/UploadPrescriptionModal';
import ChatWindow from '../components/chat/ChatWindow';

interface Appointment {
  id: string;
  patientName: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  timeSlot: string;
  status: string;
  hasPrescription?: boolean;
}

const DoctorAppointments: React.FC = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeChat, setActiveChat] = useState<{ conversationId: string, patientName: string, patientId: string } | null>(null);

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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900">Patient Consultations</h1>
          <p className="text-gray-500 mt-1">Manage your appointments and provide prescriptions.</p>
        </div>

        {successMessage && (
          <div className="mb-6 bg-green-100 text-green-700 p-4 rounded-2xl font-bold animate-fade-in text-center">
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
              <div key={apt.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl">
                    👤
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{apt.patientName}</h3>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full">
                        📅 {new Date(apt.appointmentDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full">
                        ⏰ {apt.timeSlot}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${apt.status === 'CONFIRMED' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-yellow-50 text-yellow-600 border-yellow-100'
                        }`}>
                        {apt.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-nowrap items-center gap-3 w-full lg:w-auto">
                  {apt.status === 'CONFIRMED' && (
                    <>
                      <button
                        onClick={() => handleStartConsultation(apt)}
                        className="min-w-[210px] h-9 bg-green-600 hover:bg-green-700 text-white px-6 rounded-xl font-semibold transition-all shadow-md active:scale-95 flex items-center justify-center"
                      >
                        💬 Start Consultation
                      </button>
                      <button
                        onClick={() => navigate(`/consultation/${apt.id}`)}
                        className="min-w-[210px] h-9 bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-xl font-semibold transition-all shadow-md active:scale-95 flex items-center justify-center"
                      >
                        📹 Join Video Call
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedAppointment(apt)}
                    className="min-w-[210px] h-9 bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-xl font-semibold transition-all shadow-md active:scale-95 flex items-center justify-center"
                  >
                    Upload Prescription
                  </button>
                  <button
                    className="min-w-[140px] h-9 bg-white border border-gray-200 text-gray-700 px-6 rounded-xl font-semibold hover:bg-gray-50 transition-all flex items-center justify-center"
                  >
                    Cancel
                  </button>
                </div>
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
      </div>
    </div>
  );
};

export default DoctorAppointments;
