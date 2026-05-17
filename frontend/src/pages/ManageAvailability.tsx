import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Availability {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const ManageAvailability: React.FC = () => {
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem('userId');
      const response = await api.get(`/doctors/availability?userId=${userId}`);
      setAvailabilities(response.data);
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSlot = (day: string) => {
    setAvailabilities([...availabilities, { dayOfWeek: day, startTime: '09:00', endTime: '13:00' }]);
  };

  const handleRemoveSlot = (index: number) => {
    const newAvailabilities = [...availabilities];
    newAvailabilities.splice(index, 1);
    setAvailabilities(newAvailabilities);
  };

  const handleUpdateSlot = (index: number, field: keyof Availability, value: string) => {
    const newAvailabilities = [...availabilities];
    newAvailabilities[index] = { ...newAvailabilities[index], [field]: value };
    setAvailabilities(newAvailabilities);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');
      const userId = localStorage.getItem('userId');
      await api.post(`/doctors/availability?userId=${userId}`, availabilities);
      setMessage('Availability saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving availability:', error);
      setMessage('Failed to save availability.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Manage Schedule</h1>
            <p className="text-gray-500">Define your available working hours for each day.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-70"
          >
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl font-medium text-center ${message.includes('successfully') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {DAYS.map((day) => (
              <div key={day} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-800">{day}</h3>
                  <button
                    onClick={() => handleAddSlot(day)}
                    className="text-blue-600 text-sm font-bold hover:underline"
                  >
                    + Add Time Range
                  </button>
                </div>

                <div className="space-y-3">
                  {availabilities
                    .map((slot, index) => ({ slot, index }))
                    .filter(({ slot }) => slot.dayOfWeek === day)
                    .map(({ slot, index }) => (
                      <div key={index} className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl">
                        <div className="flex-1 grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase">Start</span>
                            <input
                              type="time"
                              value={slot.startTime.substring(0, 5)}
                              onChange={(e) => handleUpdateSlot(index, 'startTime', e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase">End</span>
                            <input
                              type="time"
                              value={slot.endTime.substring(0, 5)}
                              onChange={(e) => handleUpdateSlot(index, 'endTime', e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveSlot(index)}
                          className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  {availabilities.filter((s) => s.dayOfWeek === day).length === 0 && (
                    <p className="text-sm text-gray-400 italic">No working hours set for this day.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageAvailability;
