import React, { useState } from 'react';
import api from '../services/api';

interface UploadModalProps {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const UploadPrescriptionModal: React.FC<UploadModalProps> = ({ appointmentId, patientId, doctorId, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 100 * 1024) {
        setError('File size must be less than 100 KB');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('appointmentId', appointmentId);
    formData.append('patientId', patientId);
    formData.append('doctorId', doctorId);
    formData.append('notes', notes);
    formData.append('file', file);

    try {
      setLoading(true);
      await api.post('/records/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      onSuccess();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Failed to upload prescription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
        <div className="bg-blue-600 p-6 text-white">
          <h2 className="text-2xl font-bold">Upload Prescription</h2>
          <p className="text-blue-100 opacity-80">Max size: 100 KB • PDF or Image</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Notes / Instructions</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-blue-500 outline-none h-24"
              placeholder="e.g. Take 1 tablet twice a day..."
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Select File</label>
            <div className="relative group">
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label 
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">📄</span>
                  <p className="text-sm text-gray-500">
                    {file ? file.name : 'Click to upload PDF or Image'}
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-70"
            >
              {loading ? 'Uploading...' : 'Upload Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadPrescriptionModal;
