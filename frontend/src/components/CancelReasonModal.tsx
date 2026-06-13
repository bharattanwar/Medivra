import React, { useState } from 'react';
import api from '../services/api';

interface CancelReasonModalProps {
  appointmentId: string;
  mode: 'cancel' | 'reject';
  onClose: () => void;
  onSuccess: () => void;
}

const PREDEFINED_REASONS = [
  'Doctor unavailable',
  'Emergency leave',
  'Patient requested',
  'Schedule conflict',
  'Technical issue',
  'Other',
];

const CancelReasonModal: React.FC<CancelReasonModalProps> = ({ appointmentId, mode, onClose, onSuccess }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isCancel = mode === 'cancel';
  const title = isCancel ? 'Cancel Appointment' : 'Reject Appointment';
  const subtitle = isCancel
    ? 'Please select a reason for cancellation. If this appointment was already paid, a refund will be initiated automatically.'
    : 'Please provide a reason for rejecting this appointment request.';
  const actionLabel = isCancel ? 'Confirm Cancellation' : 'Confirm Rejection';
  const actionColor = isCancel
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    : 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500';
  const headerColor = isCancel
    ? 'bg-gradient-to-r from-red-600 to-red-700'
    : 'bg-gradient-to-r from-orange-500 to-orange-600';

  const finalReason = selectedReason === 'Other' ? customReason : selectedReason;

  const handleSubmit = async () => {
    if (!finalReason.trim()) {
      setError('Please select or provide a reason.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userId = localStorage.getItem('userId');
      const endpoint = isCancel
        ? `/appointments/${appointmentId}/cancel`
        : `/appointments/${appointmentId}/reject`;

      await api.put(endpoint, {
        reason: finalReason.trim(),
        cancelledBy: userId,
      });

      onSuccess();
    } catch (err: any) {
      console.error(`Failed to ${mode} appointment:`, err);
      setError(err.response?.data?.message || err.response?.data || `Failed to ${mode} appointment. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${headerColor} p-6 text-white relative`}>
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
              {isCancel ? '🚫' : '❌'}
            </div>
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="text-sm text-white/80 mt-0.5">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium flex items-center gap-2 border border-red-100">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Reason selection */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Select a reason</label>
            <div className="grid grid-cols-1 gap-2">
              {PREDEFINED_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => {
                    setSelectedReason(reason);
                    setError('');
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all font-medium text-sm ${
                    selectedReason === reason
                      ? isCancel
                        ? 'bg-red-50 border-red-300 text-red-700 shadow-sm'
                        : 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedReason === reason
                        ? isCancel ? 'border-red-500' : 'border-orange-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedReason === reason && (
                        <span className={`w-2 h-2 rounded-full ${isCancel ? 'bg-red-500' : 'bg-orange-500'}`} />
                      )}
                    </span>
                    {reason}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom reason textarea (shown when "Other" is selected) */}
          {selectedReason === 'Other' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Provide details</label>
              <textarea
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value);
                  setError('');
                }}
                placeholder="Please describe the reason..."
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none transition-all resize-none text-sm"
                rows={3}
              />
            </div>
          )}

          {/* Refund notice for cancel mode */}
          {isCancel && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
              <span className="text-blue-600 text-lg mt-0.5">💳</span>
              <p className="text-xs text-blue-700">
                If this appointment was already paid, a <strong>full refund</strong> will be initiated automatically upon cancellation.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all text-sm disabled:opacity-50"
            >
              Go Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !finalReason.trim()}
              className={`flex-1 px-4 py-3 rounded-xl text-white font-semibold transition-all text-sm shadow-lg active:scale-95 focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${actionColor}`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Processing...
                </span>
              ) : (
                actionLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancelReasonModal;
