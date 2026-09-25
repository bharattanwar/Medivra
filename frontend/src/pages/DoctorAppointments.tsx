import React, { useState, useEffect } from 'react';
import api from '../services/api';
import UploadPrescriptionModal from '../components/UploadPrescriptionModal';
import ViewPrescriptionModal from '../components/ViewPrescriptionModal';
import ChatWindow from '../components/chat/ChatWindow';
import CancelReasonModal from '../components/CancelReasonModal';
import RescheduleModal from '../components/RescheduleModal';
import PreJoinCallModal, { type PreJoinAppointmentInfo } from '../components/PreJoinCallModal';
import DoctorBriefModal from '../components/DoctorBriefModal';
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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptionsMap, setPrescriptionsMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [viewPrescriptionApt, setViewPrescriptionApt] = useState<Appointment | null>(null);
  const [briefPatient, setBriefPatient] = useState<{ id: string; name: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeChat, setActiveChat] = useState<{ conversationId: string; patientName: string; patientId: string } | null>(null);
  const [preJoinApt, setPreJoinApt] = useState<PreJoinAppointmentInfo | null>(null);

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
      const aptList: Appointment[] = response.data || [];
      setAppointments(aptList);

      // Check prescription existence for appointments in parallel
      const map: Record<string, boolean> = {};
      await Promise.allSettled(
        aptList.map(async (apt) => {
          try {
            const recRes = await api.get(`/records/appointment/${apt.id}`);
            if (recRes.data && recRes.data.id) {
              map[apt.id] = true;
            }
          } catch {
            // No record for this appointment
          }
        })
      );
      setPrescriptionsMap(map);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    const uploadedAptId = selectedAppointment?.id;
    if (uploadedAptId) {
      setPrescriptionsMap((prev) => ({ ...prev, [uploadedAptId]: true }));
    }
    setSelectedAppointment(null);
    setSuccessMessage('Prescription uploaded and Treatment Plan activated successfully!');
    fetchAppointments();
    setTimeout(() => setSuccessMessage(''), 4000);
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
        return 'bg-green-50 text-green-700 border-green-200';
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'CANCELLED':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'REJECTED':
        return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'RESCHEDULED':
        return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'PENDING_RESCHEDULE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'COMPLETED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'IN_PROGRESS':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const doctorUserId = localStorage.getItem('userId');

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Patient Consultations & Records</h1>
            <p className="text-slate-500 mt-1">Review clinical briefs, conduct consultations, and manage digital prescriptions.</p>
          </div>
          <button 
            onClick={fetchAppointments}
            className="p-2.5 bg-white rounded-2xl border border-slate-200 hover:bg-slate-50 shadow-sm transition-all text-slate-700 hover:text-slate-900 flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {successMessage && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl font-bold animate-fade-in text-center shadow-sm flex items-center justify-center gap-2">
            <span>✓</span> {successMessage}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-600"></div>
          </div>
        ) : appointments.length > 0 ? (
          <div className="grid gap-5">
            {appointments.map((apt) => {
              const elapsed = isAppointmentElapsed(apt.appointmentDate, apt.timeSlot);
              const hasRx = prescriptionsMap[apt.id] || apt.hasPrescription;

              return (
                <div 
                  key={apt.id} 
                  className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 flex flex-col gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    {/* Patient & Slot Info */}
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-indigo-50 to-blue-100 border border-indigo-100 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-inner">
                        👤
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">{apt.patientName}</h3>
                          {hasRx && (
                            <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1">
                              ✓ Prescription Uploaded
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full text-xs font-medium text-slate-700">
                            📅 {new Date(apt.appointmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full text-xs font-medium text-slate-700">
                            ⏰ {apt.timeSlot}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(apt.status)}`}>
                            {apt.status}
                          </span>
                          {elapsed && apt.status === 'CONFIRMED' && (
                            <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold rounded-full">
                              ⏰ Slot Elapsed
                            </span>
                          )}
                          {apt.consultationType && (
                            <span className="px-2.5 py-1 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium rounded-full">
                              {apt.consultationType === 'IN_CLINIC' ? '🏥 In-Clinic' : '📹 Video'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                      {/* 📋 Doctor Brief is ALWAYS accessible for the patient */}
                      <button 
                        type="button"
                        onClick={() => setBriefPatient({ id: apt.patientId, name: apt.patientName })}
                        className="flex-1 lg:flex-initial h-9 bg-slate-900 hover:bg-slate-800 text-white px-3.5 rounded-xl font-semibold transition-all shadow-sm active:scale-95 flex items-center justify-center text-xs gap-1.5 cursor-pointer"
                        title="View Patient Pre-Consultation Clinical Brief & Health Journey"
                      >
                        📋 Doctor Brief
                      </button>

                      {/* 📄 View Prescription Button (when uploaded) */}
                      {hasRx && (
                        <button 
                          type="button"
                          onClick={() => setViewPrescriptionApt(apt)}
                          className="flex-1 lg:flex-initial h-9 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 rounded-xl font-semibold transition-all shadow-sm active:scale-95 flex items-center justify-center text-xs gap-1.5 cursor-pointer"
                          title="View prescribed medications and digital Rx document"
                        >
                          📄 View Prescription
                        </button>
                      )}

                      {/* CONFIRMED Appointments */}
                      {apt.status === 'CONFIRMED' && (
                        <>
                          {!elapsed ? (
                            <>
                              <button 
                                onClick={() => handleStartConsultation(apt)}
                                className="flex-1 lg:flex-initial h-9 bg-teal-600 hover:bg-teal-700 text-white px-3.5 rounded-xl font-semibold transition-all shadow-sm active:scale-95 flex items-center justify-center text-xs gap-1.5 cursor-pointer"
                              >
                                💬 Start Consultation
                              </button>
                              {apt.consultationType !== 'IN_CLINIC' && (
                                <button 
                                  onClick={() => setPreJoinApt({
                                    id: apt.id,
                                    doctorId: apt.doctorId,
                                    doctorName: apt.doctorName,
                                    patientId: apt.patientId,
                                    patientName: apt.patientName,
                                    appointmentDate: apt.appointmentDate,
                                    timeSlot: apt.timeSlot
                                  })}
                                  className="flex-1 lg:flex-initial h-9 bg-blue-600 hover:bg-blue-700 text-white px-3.5 rounded-xl font-semibold transition-all shadow-sm active:scale-95 flex items-center justify-center text-xs gap-1.5 cursor-pointer"
                                >
                                  📹 Join Video Call
                                </button>
                              )}
                              <button 
                                onClick={() => setSelectedAppointment(apt)}
                                className={`flex-1 lg:flex-initial h-9 ${hasRx ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'} px-3.5 rounded-xl font-semibold transition-all active:scale-95 flex items-center justify-center text-xs gap-1.5 cursor-pointer`}
                              >
                                {hasRx ? '✏️ Re-upload Rx' : '📤 Upload Prescription'}
                              </button>
                              {isCancelable(apt.appointmentDate) && (
                                <>
                                  <button 
                                    onClick={() => setRescheduleModalApt({ id: apt.id, doctorId: apt.doctorId, doctorName: apt.doctorName })}
                                    className="flex-1 lg:flex-initial h-9 bg-white border border-blue-200 text-blue-600 px-3 rounded-xl font-semibold hover:bg-blue-50 transition-all flex items-center justify-center text-xs gap-1 cursor-pointer"
                                  >
                                    📅 Reschedule
                                  </button>
                                  <button 
                                    onClick={() => setCancelModalApt({ id: apt.id, mode: 'cancel' })}
                                    className="flex-1 lg:flex-initial h-9 bg-white border border-red-200 text-red-600 px-3 rounded-xl font-semibold hover:bg-red-50 transition-all flex items-center justify-center text-xs gap-1 cursor-pointer"
                                  >
                                    🚫 Cancel
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            /* Elapsed confirmed slot */
                            <>
                              <button 
                                onClick={() => setSelectedAppointment(apt)}
                                className={`flex-1 lg:flex-initial h-9 ${hasRx ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'} px-3.5 rounded-xl font-semibold transition-all active:scale-95 flex items-center justify-center text-xs gap-1.5 cursor-pointer`}
                              >
                                {hasRx ? '✏️ Re-upload Rx' : '📤 Upload Prescription'}
                              </button>
                            </>
                          )}
                        </>
                      )}

                      {/* COMPLETED Appointments */}
                      {apt.status === 'COMPLETED' && (
                        <>
                          <button 
                            onClick={() => setSelectedAppointment(apt)}
                            className={`flex-1 lg:flex-initial h-9 ${hasRx ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'} px-3.5 rounded-xl font-semibold transition-all active:scale-95 flex items-center justify-center text-xs gap-1.5 cursor-pointer`}
                          >
                            {hasRx ? '✏️ Edit Prescription' : '📤 Upload Prescription'}
                          </button>
                        </>
                      )}

                      {/* PENDING Appointments */}
                      {apt.status === 'PENDING' && (
                        <>
                          {!elapsed && isCancelable(apt.appointmentDate) && (
                            <button 
                              onClick={() => setRescheduleModalApt({ id: apt.id, doctorId: apt.doctorId, doctorName: apt.doctorName })}
                              className="flex-1 lg:flex-initial h-9 bg-white border border-blue-200 text-blue-600 px-3 rounded-xl font-semibold hover:bg-blue-50 transition-all flex items-center justify-center text-xs gap-1 cursor-pointer"
                            >
                              📅 Reschedule
                            </button>
                          )}
                          <button 
                            onClick={() => setCancelModalApt({ id: apt.id, mode: 'reject' })}
                            className="flex-1 lg:flex-initial h-9 bg-white border border-orange-200 text-orange-600 px-3 rounded-xl font-semibold hover:bg-orange-50 transition-all flex items-center justify-center text-xs gap-1 cursor-pointer"
                          >
                            ❌ Reject Request
                          </button>
                        </>
                      )}

                      {/* PENDING_RESCHEDULE Appointments */}
                      {apt.status === 'PENDING_RESCHEDULE' && (
                        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                          {apt.cancelledBy !== doctorUserId ? (
                            <>
                              <button
                                onClick={() => handleAcceptReschedule(apt.id)}
                                className="flex-1 lg:flex-initial h-9 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 rounded-xl font-semibold transition-all shadow-sm active:scale-95 flex items-center justify-center text-xs gap-1.5 cursor-pointer"
                              >
                                ✅ Accept Reschedule
                              </button>
                              <button
                                onClick={() => handleRejectReschedule(apt.id)}
                                className="flex-1 lg:flex-initial h-9 bg-red-600 hover:bg-red-700 text-white px-3.5 rounded-xl font-semibold transition-all shadow-sm active:scale-95 flex items-center justify-center text-xs gap-1.5 cursor-pointer"
                              >
                                ❌ Reject Reschedule
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                              ⏳ Waiting for Patient's Approval
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cancellation / Rejection / Rescheduled reason details */}
                  {(apt.status === 'CANCELLED' || apt.status === 'REJECTED' || apt.status === 'RESCHEDULED' || apt.status === 'PENDING_RESCHEDULE') && apt.cancellationReason && (
                    <div className="border-t pt-3 mt-1 border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <div className="text-xs">
                        <span className="font-bold text-slate-700">
                          {(apt.status === 'RESCHEDULED' || apt.status === 'PENDING_RESCHEDULE') ? 'Rescheduled Reason: ' : 'Reason: '}
                        </span>
                        <span className="text-slate-600 italic">"{apt.cancellationReason}"</span>
                      </div>
                      {apt.cancelledBy && (
                        <span className="text-[11px] text-slate-400 font-medium bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 self-start sm:self-auto shrink-0">
                          Action by: {apt.cancelledBy === doctorUserId ? 'You' : 'Patient'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
            <div className="text-6xl mb-4">🩺</div>
            <h3 className="text-xl font-bold text-slate-900">No appointments scheduled</h3>
            <p className="text-slate-500 mt-2">When patients book slots, they will appear here.</p>
          </div>
        )}

        {/* Prescription Upload / Creation Modal */}
        {selectedAppointment && (
          <UploadPrescriptionModal
            appointmentId={selectedAppointment.id}
            patientId={selectedAppointment.patientId}
            doctorId={selectedAppointment.doctorId}
            onClose={() => setSelectedAppointment(null)}
            onSuccess={handleUploadSuccess}
          />
        )}

        {/* View Prescription Modal */}
        {viewPrescriptionApt && (
          <ViewPrescriptionModal
            appointmentId={viewPrescriptionApt.id}
            patientName={viewPrescriptionApt.patientName}
            appointmentDate={viewPrescriptionApt.appointmentDate}
            timeSlot={viewPrescriptionApt.timeSlot}
            onClose={() => setViewPrescriptionApt(null)}
          />
        )}

        {/* Active Consultation Chat Window */}
        {activeChat && (
          <ChatWindow 
            conversationId={activeChat.conversationId}
            otherPartyName={activeChat.patientName}
            otherPartyId={activeChat.patientId}
            onClose={() => setActiveChat(null)}
          />
        )}

        {/* Cancel / Reject Reason Modal */}
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

        {/* Reschedule Modal */}
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

        {/* Pre-Join Video Call Modal */}
        <PreJoinCallModal
          isOpen={!!preJoinApt}
          onClose={() => setPreJoinApt(null)}
          appointment={preJoinApt}
        />

        {/* Doctor Clinical Brief Modal */}
        {briefPatient && (
          <DoctorBriefModal
            patientId={briefPatient.id}
            patientName={briefPatient.name}
            onClose={() => setBriefPatient(null)}
          />
        )}
      </div>
    </div>
  );
};

export default DoctorAppointments;
