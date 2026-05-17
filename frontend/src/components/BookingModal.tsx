import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { processConsultationPayment } from './PaymentCheckout';

interface BookingModalProps {
  doctor: {
    id: string;
    fullName: string;
    specialization: string;
    consultationFee: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const BookingModal: React.FC<BookingModalProps> = ({ doctor, onClose, onSuccess }) => {
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);

  useEffect(() => {
    if (date) {
      fetchDoctorSlots();
    }
  }, [date]);

  const fetchDoctorSlots = async () => {
    try {
      setFetchingSlots(true);
      setError('');
      const response = await api.get(`/doctors/${doctor.id}/availability`);
      const availabilities = response.data;

      const selectedDay = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      const dayAvailabilities = availabilities.filter((a: any) => a.dayOfWeek === selectedDay);

      const slots: string[] = [];
      dayAvailabilities.forEach((range: any) => {
        let current = parseTime(range.startTime);
        const end = parseTime(range.endTime);

        while (current < end) {
          const next = new Date(current.getTime() + 30 * 60000);
          if (next > end) break;
          slots.push(`${formatTime(current)} - ${formatTime(next)}`);
          current = next;
        }
      });

      setAvailableSlots(slots);
      if (slots.length === 0) {
        setError('Doctor is not available on this day.');
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
      setError('Failed to fetch doctor availability.');
    } finally {
      setFetchingSlots(false);
    }
  };

  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !timeSlot) {
      setError('Please select both date and time slot');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Get patientId from token/localStorage
      const patientId = localStorage.getItem('userId'); // Assuming userId is stored in localStorage

      if (!patientId) {
        setError('User session not found. Please log in again.');
        return;
      }

      const bookingResponse = await api.post('/appointments', {
        doctorId: doctor.id,
        patientId: patientId,
        appointmentDate: date,
        timeSlot: timeSlot
      });

      const appointmentId = bookingResponse.data.id;

      await processConsultationPayment({
        appointmentId,
        patientId,
        doctorName: doctor.fullName,
        amount: doctor.consultationFee,
        onSuccess: () => {
          onSuccess();
        },
        onError: (message) => {
          setError(message);
        },
      });
    } catch (err: any) {
      console.error('Booking error:', err);
      setError(err.response?.data?.message || 'Failed to book appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-scale-in">
        <div className="bg-blue-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-blue-700 rounded-full p-2 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold">Book Appointment</h2>
          <p className="text-blue-100">Dr. {doctor.fullName} • {doctor.specialization}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Select Date</label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Select Time Slot</label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {fetchingSlots ? (
                <div className="flex justify-center py-4">
                  <span className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></span>
                </div>
              ) : availableSlots.length > 0 ? (
                availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTimeSlot(slot)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all font-medium ${timeSlot === slot
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                        : 'border-gray-100 hover:border-blue-300 hover:bg-blue-50 text-gray-600'
                      }`}
                  >
                    {slot}
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-400 italic text-center py-4">
                  {date ? 'No slots available for this date.' : 'Please select a date first.'}
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Total Fee</p>
              <p className="text-xl font-bold text-gray-900">₹{doctor.consultationFee}</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
            >
              {loading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  Processing...
                </>
              ) : (
                'Book & Pay'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingModal;
