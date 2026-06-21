import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Plus, Trash2, AlertCircle, FileText, Search, Loader2 } from 'lucide-react';
import api from '../services/api';

interface UploadModalProps {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PrescriptionMedicine {
  name: string;
  strength: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface SystemMedicine {
  id: string;
  name: string;
  manufacturer?: string;
  strength?: string;
}

interface DoctorMedicine {
  id: string;
  name: string;
  strength?: string;
}

const UploadPrescriptionModal: React.FC<UploadModalProps> = ({ appointmentId, patientId, doctorId, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'upload' | 'digital'>('digital');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Upload Mode State
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');

  // Digital Mode State
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>([]);
  const [medQuery, setMedQuery] = useState('');
  const [medSuggestions, setMedSuggestions] = useState<SystemMedicine[]>([]);
  const [doctorMedicines, setDoctorMedicines] = useState<DoctorMedicine[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Current adding medicine form
  const [currentMed, setCurrentMed] = useState({
    name: '',
    strength: '',
    dosage: '1 tablet',
    frequency: '1-0-1',
    duration: '5 days',
    saveToMyList: false
  });

  // Fetch Doctor's specific medicines
  const fetchDoctorMedicines = useCallback(async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) return;
      const res = await api.get(`/doctors/medicines?userId=${userId}`);
      if (res.data.success) {
        setDoctorMedicines(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load doctor medicines', err);
    }
  }, []);

  useEffect(() => {
    fetchDoctorMedicines();
  }, [fetchDoctorMedicines]);

  // Autocomplete search debounce for system medicines
  useEffect(() => {
    if (medQuery.length < 2) {
      setMedSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setSuggestLoading(true);
        const res = await api.get(`/medicines/search?q=${encodeURIComponent(medQuery)}`);
        if (res.data.success) {
          setMedSuggestions(res.data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSuggestLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [medQuery]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10 MB');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleAddMedicine = () => {
    if (!currentMed.name.trim()) {
      setError('Please specify a medicine name');
      return;
    }
    const newMed: PrescriptionMedicine = {
      name: currentMed.name.trim(),
      strength: currentMed.strength.trim(),
      dosage: currentMed.dosage.trim(),
      frequency: currentMed.frequency.trim(),
      duration: currentMed.duration.trim()
    };

    setMedicines(prev => [...prev, newMed]);
    
    // Clear adding form (keep defaults)
    setCurrentMed({
      name: '',
      strength: '',
      dosage: '1 tablet',
      frequency: '1-0-1',
      duration: '5 days',
      saveToMyList: false
    });
    setMedQuery('');
    setMedSuggestions([]);
    setError('');
  };

  const handleRemoveMedicine = (idx: number) => {
    setMedicines(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'upload') {
        if (!file) {
          setError('Please select a file');
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append('appointmentId', appointmentId);
        formData.append('patientId', patientId);
        formData.append('doctorId', doctorId);
        formData.append('notes', notes);
        formData.append('file', file);

        await api.post('/records/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        if (medicines.length === 0) {
          setError('Please add at least one medicine to the prescription');
          setLoading(false);
          return;
        }



        // Send digital prescription request
        await api.post('/records/digital', {
          appointmentId,
          doctorId,
          patientId,
          notes,
          medicines
        });
      }
      onSuccess();
    } catch (err: any) {
      console.error('Prescription save error:', err);
      setError(err.response?.data?.message || 'Failed to submit prescription');
    } finally {
      setLoading(false);
    }
  };

  const saveToDoctorList = async (name: string, strength: string) => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    try {
      await api.post(`/doctors/medicines?userId=${userId}`, {
        name,
        strength
      });
      fetchDoctorMedicines();
    } catch (err) {
      console.error('Failed to save to doctor list', err);
    }
  };

  // Filter local doctor medicines based on query
  const filteredDoctorMeds = doctorMedicines.filter(m =>
    m.name.toLowerCase().includes(medQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white shrink-0">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6" /> Create Prescription
          </h2>
          <p className="text-indigo-100 text-sm mt-1">Configure patient prescription details below</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-100 shrink-0">
          <button
            type="button"
            onClick={() => { setMode('digital'); setError(''); }}
            className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${
              mode === 'digital'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/10'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles className="h-4 w-4" /> Digital Builder
          </button>
          <button
            type="button"
            onClick={() => { setMode('upload'); setError(''); }}
            className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${
              mode === 'upload'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/10'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="h-4 w-4" /> Upload File
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm font-semibold flex items-center gap-2 animate-fade-in shrink-0">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" /> {error}
            </div>
          )}

          {mode === 'upload' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Notes / Instructions</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none h-28 text-slate-900 transition-all text-sm"
                  placeholder="e.g. Take 1 tablet twice a day after meals..."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Select File</label>
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
                    className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-3xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <span className="text-4xl mb-2 group-hover:scale-110 transition-transform">📄</span>
                      <p className="text-sm font-semibold text-slate-700">
                        {file ? file.name : 'Click to upload PDF or Image'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Max file size: 10 MB</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Add Medicine Section */}
              <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Add Medicine</h3>
                
                {/* Search / Name Autocomplete Input */}
                <div className="relative space-y-1">
                  <label className="text-xs font-bold text-slate-500">Search/Enter Medicine Name</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    {suggestLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500 animate-spin" />
                    )}
                    <input
                      type="text"
                      value={medQuery}
                      onChange={(e) => {
                        setMedQuery(e.target.value);
                        setCurrentMed(prev => ({ ...prev, name: e.target.value }));
                      }}
                      placeholder="Type medicine name (e.g. Paracetamol)..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>

                  {/* Suggestions Dropdown (System + Doctor Specific) */}
                  {medQuery.length >= 1 && (filteredDoctorMeds.length > 0 || medSuggestions.length > 0) && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                      {/* Doctor Specific Section */}
                      {filteredDoctorMeds.map(m => (
                        <button
                          key={`doc-${m.id}`}
                          type="button"
                          onClick={() => {
                            setCurrentMed(prev => ({ ...prev, name: m.name, strength: m.strength || '' }));
                            setMedQuery(m.name);
                            setMedSuggestions([]);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-indigo-50 border-b border-slate-100 last:border-b-0 transition-colors flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                            <p className="text-xs text-slate-400">{m.strength && `Strength: ${m.strength}`}</p>
                          </div>
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⭐ My Medicine</span>
                        </button>
                      ))}

                      {/* System Medicines Section */}
                      {medSuggestions.map(m => (
                        <button
                          key={`sys-${m.id}`}
                          type="button"
                          onClick={() => {
                            setCurrentMed(prev => ({ ...prev, name: m.name, strength: m.strength || '' }));
                            setMedQuery(m.name);
                            setMedSuggestions([]);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-indigo-50 border-b border-slate-100 last:border-b-0 transition-colors"
                        >
                          <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.manufacturer || 'System'} {m.strength && `· ${m.strength}`}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Strength</label>
                    <input
                      type="text"
                      value={currentMed.strength}
                      onChange={e => setCurrentMed(prev => ({ ...prev, strength: e.target.value }))}
                      placeholder="e.g. 500mg"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Dosage</label>
                    <input
                      type="text"
                      value={currentMed.dosage}
                      onChange={e => setCurrentMed(prev => ({ ...prev, dosage: e.target.value }))}
                      placeholder="e.g. 1 tablet"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Frequency</label>
                    <input
                      type="text"
                      value={currentMed.frequency}
                      onChange={e => setCurrentMed(prev => ({ ...prev, frequency: e.target.value }))}
                      placeholder="e.g. 1-0-1"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Duration</label>
                    <input
                      type="text"
                      value={currentMed.duration}
                      onChange={e => setCurrentMed(prev => ({ ...prev, duration: e.target.value }))}
                      placeholder="e.g. 5 days"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentMed.saveToMyList}
                      onChange={e => setCurrentMed(prev => ({ ...prev, saveToMyList: e.target.checked }))}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    Save to my specific medicines list
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      if (currentMed.saveToMyList) {
                        saveToDoctorList(currentMed.name, currentMed.strength);
                      }
                      handleAddMedicine();
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> Add to Prescription
                  </button>
                </div>
              </div>

              {/* Medicines List / Table */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Prescribed Medicines</label>
                {medicines.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-3xl">
                    <Sparkles className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Add medicines using the form above.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase">
                            <th className="px-4 py-2.5">Name</th>
                            <th className="px-4 py-2.5">Strength</th>
                            <th className="px-4 py-2.5">Dosage</th>
                            <th className="px-4 py-2.5">Frequency</th>
                            <th className="px-4 py-2.5">Duration</th>
                            <th className="px-4 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {medicines.map((m, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-semibold text-slate-900">{m.name}</td>
                              <td className="px-4 py-3 text-slate-600">{m.strength || '—'}</td>
                              <td className="px-4 py-3 text-slate-600">{m.dosage}</td>
                              <td className="px-4 py-3 text-slate-600">{m.frequency}</td>
                              <td className="px-4 py-3 text-slate-600">{m.duration}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMedicine(idx)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">General Advice / Instructions</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none h-24 text-slate-900 transition-all text-sm"
                  placeholder="e.g. Drink plenty of fluids, rest well..."
                />
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-4 pt-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (mode === 'upload' && !file) || (mode === 'digital' && medicines.length === 0)}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Saving…</>
              ) : (
                <>Save & Submit</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadPrescriptionModal;
