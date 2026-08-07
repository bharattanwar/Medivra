import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { processConsultationPayment } from './PaymentCheckout';
import { Calendar, Clock, Video, Building2, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface BookingModalProps {
  doctor: {
    id: string;
    fullName: string;
    specialization: string;
    consultationFee: number;
    availableInClinic?: boolean;
    availableVideo?: boolean;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const DAYS_ORDER = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const BookingModal: React.FC<BookingModalProps> = ({ doctor, onClose, onSuccess }) => {
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [consultationType, setConsultationType] = useState<'ONLINE' | 'IN_CLINIC'>(
    doctor.availableVideo === false ? 'IN_CLINIC' : 'ONLINE'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [loadingDays, setLoadingDays] = useState(true);

  // Load the doctor's weekly availability on mount to populate day pills
  useEffect(() => {
    const loadDoctorDays = async () => {
      try {
        const response = await api.get(`/doctors/${doctor.id}/availability`);
        const days = new Set<string>((response.data || []).map((a: any) => a.dayOfWeek as string));
        setAvailableDays(days);
      } catch {
        // silently ignore — day pills just won't be highlighted
      } finally {
        setLoadingDays(false);
      }
    };
    loadDoctorDays();
  }, [doctor.id]);

  useEffect(() => {
    if (date) {
      fetchDoctorSlots();
    } else {
      setAvailableSlots([]);
      setBookedSlots([]);
      setTimeSlot('');
    }
  }, [date]);

  const fetchDoctorSlots = async () => {
    try {
      setFetchingSlots(true);
      setError('');
      setTimeSlot('');
      setAvailableSlots([]);
      setBookedSlots([]);

      // Fix: append T00:00:00 so Date() parses as LOCAL time, not UTC midnight
      const localDate = new Date(date + 'T00:00:00');
      const selectedDay = DAYS_ORDER[localDate.getDay()];

      const [availabilityRes, bookedRes] = await Promise.all([
        api.get(`/doctors/${doctor.id}/availability`),
        api.get(`/appointments/doctor/${doctor.id}/booked-slots?date=${date}`),
      ]);

      const availabilities = availabilityRes.data || [];
      const booked: string[] = bookedRes.data || [];
      setBookedSlots(booked);

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
        const availDayNames = [...availableDays]
          .map(d => DAY_SHORT[DAYS_ORDER.indexOf(d)])
          .filter(Boolean)
          .join(', ');
        setError(
          availDayNames
            ? `No slots on ${localDate.toLocaleDateString('en-US', { weekday: 'long' })}. Try: ${availDayNames}`
            : 'Doctor has no availability on this day.'
        );
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
      setError('Failed to fetch availability. Please try again.');
    } finally {
      setFetchingSlots(false);
    }
  };

  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !timeSlot) {
      setError('Please select both a date and a time slot.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const patientId = localStorage.getItem('userId');
      if (!patientId) {
        setError('User session not found. Please log in again.');
        return;
      }
      const bookingResponse = await api.post('/appointments', {
        doctorId: doctor.id,
        patientId,
        appointmentDate: date,
        timeSlot,
        consultationType,
      });
      const appointmentId = bookingResponse.data.id;
      if (consultationType === 'IN_CLINIC') {
        onSuccess();
      } else {
        await processConsultationPayment({
          appointmentId,
          patientId,
          doctorName: doctor.fullName,
          amount: doctor.consultationFee,
          onSuccess: () => onSuccess(),
          onError: (message) => setError(message),
        });
      }
    } catch (err: any) {
      console.error('Booking error:', err);
      setError(err.response?.data?.message || 'Failed to book appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const availableSlotsFiltered = availableSlots.filter(s => !bookedSlots.includes(s));
  const totalSlots = availableSlots.length;
  const remainingSlots = availableSlotsFiltered.length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1.5 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl font-bold">
              {doctor.fullName.replace('Dr. ', '').charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold">Book Appointment</h2>
              <p className="text-blue-100 text-sm">{doctor.fullName} · {doctor.specialization}</p>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* Error Banner */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Consultation Type */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Consultation Type</label>
              <div className="grid grid-cols-2 gap-3">
                {doctor.availableVideo !== false && (
                  <button
                    type="button"
                    onClick={() => setConsultationType('ONLINE')}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${doctor.availableInClinic === false ? 'col-span-2' : ''
                      } ${consultationType === 'ONLINE'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <Video className="h-4 w-4" /> Video Consult
                  </button>
                )}
                {doctor.availableInClinic !== false && (
                  <button
                    type="button"
                    onClick={() => setConsultationType('IN_CLINIC')}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${doctor.availableVideo === false ? 'col-span-2' : ''
                      } ${consultationType === 'IN_CLINIC'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <Building2 className="h-4 w-4" /> In-Clinic
                  </button>
                )}
              </div>
            </div>

            {/* Day Pills */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Doctor's Available Days</label>
              {loadingDays ? (
                <div className="flex gap-1.5">
                  {DAY_SHORT.map(d => (
                    <div key={d} className="flex-1 h-9 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="flex gap-1.5">
                  {DAYS_ORDER.map((day, idx) => {
                    const isAvailable = availableDays.has(day);
                    return (
                      <div
                        key={day}
                        title={isAvailable ? `Available on ${day.charAt(0) + day.slice(1).toLowerCase()}` : 'Not available'}
                        className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-all ${isAvailable
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-400'
                          }`}
                      >
                        {DAY_SHORT[idx]}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Date Picker */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Select Date</label>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => { setDate(e.target.value); setError(''); }}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-800"
                required
              />
            </div>

            {/* Time Slots */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Available Time Slots
                {date && !fetchingSlots && totalSlots > 0 && (
                  <span className="ml-auto text-xs font-medium text-gray-400">
                    {remainingSlots}/{totalSlots} slots free
                  </span>
                )}
              </label>

              <div className="min-h-[80px]">
                {!date ? (
                  <div className="flex flex-col items-center justify-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                    <Calendar className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Select a date to see available slots</p>
                  </div>
                ) : fetchingSlots ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-blue-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Loading slots...</span>
                  </div>
                ) : availableSlotsFiltered.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                    {availableSlotsFiltered.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setTimeSlot(slot)}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${timeSlot === slot
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-[1.02]'
                            : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                          }`}
                      >
                        {timeSlot === slot && <CheckCircle className="h-3.5 w-3.5 shrink-0" />}
                        <span>{slot}</span>
                      </button>
                    ))}
                  </div>
                ) : totalSlots > 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-orange-600 bg-orange-50 rounded-xl border border-orange-200">
                    <Clock className="h-7 w-7 mb-1.5 opacity-70" />
                    <p className="text-sm font-semibold">All slots booked for this date</p>
                    <p className="text-xs text-orange-500 mt-0.5">Please choose a different date</p>
                  </div>
                ) : null}
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              {consultationType === 'IN_CLINIC' ? 'Pay at Clinic' : 'Total Fee'}
            </p>
            <p className="text-2xl font-extrabold text-gray-900">₹{doctor.consultationFee}</p>
          </div>
          <button
            type="button"
            onClick={handleSubmit as any}
            disabled={loading || !date || !timeSlot}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-7 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              consultationType === 'IN_CLINIC' ? '✓ Book (Pay at Clinic)' : '✓ Book & Pay'
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default BookingModal;
