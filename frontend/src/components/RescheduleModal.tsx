import React, { useEffect, useState } from 'react';
import api from '../services/api';

interface RescheduleModalProps {
  appointmentId: string;
  doctorId: string;
  doctorName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const RescheduleModal: React.FC<RescheduleModalProps> = ({
  appointmentId,
  doctorId,
  doctorName,
  onClose,
  onSuccess,
}) => {
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);

  useEffect(() => {
    if (date) {
      fetchDoctorSlots();
    } else {
      setAvailableSlots([]);
    }
  }, [date]);

  const fetchDoctorSlots = async () => {
    try {
      setFetchingSlots(true);
      setError('');
      setTimeSlot('');
      const response = await api.get(`/doctors/${doctorId}/availability`);
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
    const dateObj = new Date();
    dateObj.setHours(hours, minutes, 0, 0);
    return dateObj;
  };

  const formatTime = (dateObj: Date) => {
    return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !timeSlot || !reason.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const userId = localStorage.getItem('userId');
      if (!userId) {
        setError('User session not found. Please log in again.');
        return;
      }

      await api.put(`/appointments/${appointmentId}/reschedule`, {
        newDate: date,
        newTimeSlot: timeSlot,
        reason: reason.trim(),
        rescheduledBy: userId,
      });

      onSuccess();
    } catch (err: any) {
      console.error('Rescheduling error:', err);
      setError(err.response?.data?.message || err.response?.data || 'Failed to reschedule appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">
              📅
            </div>
            <div>
              <h2 className="text-xl font-bold">Reschedule Appointment</h2>
              <p className="text-sm text-blue-100 mt-0.5">Dr. {doctorName}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium flex items-center gap-2 border border-red-100">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Select New Date</label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm font-medium"
              required
            />
          </div>

          {/* Time Slot Picker */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Select Time Slot</label>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {fetchingSlots ? (
                <div className="flex justify-center py-4">
                  <span className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></span>
                </div>
              ) : availableSlots.length > 0 ? (
                availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      setTimeSlot(slot);
                      setError('');
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all font-medium text-sm ${
                      timeSlot === slot
                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        timeSlot === slot ? 'border-blue-500' : 'border-gray-300'
                      }`}>
                        {timeSlot === slot && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                      </span>
                      {slot}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-xl border border-dashed">
                  {date ? 'No slots available for this date.' : 'Please select a date first.'}
                </p>
              )}
            </div>
          </div>

          {/* Reschedule Reason */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Reason for Rescheduling</label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
              placeholder="e.g., Scheduling conflict, unexpected emergency..."
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all resize-none text-sm"
              rows={3}
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !date || !timeSlot || !reason.trim()}
              className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all text-sm shadow-lg active:scale-95 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Updating...
                </>
              ) : (
                'Reschedule'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RescheduleModal;
