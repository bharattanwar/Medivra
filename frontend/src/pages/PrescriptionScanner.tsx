import React, { useState } from 'react';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Sparkles,
  Pill, Trash2, Plus, ArrowRight, Loader2, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { aiService, type ExtractedMedicine } from '../services/ai';

const PrescriptionScanner: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stageMessage, setStageMessage] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [medicines, setMedicines] = useState<ExtractedMedicine[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  const patientId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000000';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (selected.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selected));
      } else {
        setPreviewUrl(null);
      }
      setError('');
      setAnalyzed(false);
    }
  };

  const handleExtract = async () => {
    if (!file) {
      setError('Please select or upload a prescription file first.');
      return;
    }

    setLoading(true);
    setError('');
    setStageMessage('Uploading prescription document...');

    try {
      setTimeout(() => setStageMessage('Running Gemini Multimodal Vision OCR...'), 800);
      setTimeout(() => setStageMessage('Performing Levenshtein fuzzy matching against Medicine Master DB...'), 1800);

      const res = await aiService.extractPrescription(patientId, file);
      setSummary(res.rawAiSummary);
      setMedicines(res.medicines || []);
      setAnalyzed(true);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to extract prescription. Ensure your Gemini API key is configured.');
    } finally {
      setLoading(false);
      setStageMessage('');
    }
  };

  const handleUpdateMedicine = (index: number, field: keyof ExtractedMedicine, value: any) => {
    const updated = [...medicines];
    updated[index] = { ...updated[index], [field]: value };
    setMedicines(updated);
  };

  const handleRemoveMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const handleAddMedicine = () => {
    setMedicines([
      ...medicines,
      {
        extractedName: 'Custom Medicine',
        matchedMedicineId: '',
        matchedMedicineName: 'Custom Medicine',
        confidenceScore: 100,
        dosage: '1 tablet',
        frequency: '1-0-1',
        duration: '5 days',
        quantity: 10
      }
    ]);
  };

  const handleOrderNow = () => {
    // Navigate to pharmacy finder with prefilled basket
    navigate('/patient/pharmacy', {
      state: {
        prefilledItems: medicines.map(m => ({
          medicineId: m.matchedMedicineId,
          medicineName: m.matchedMedicineName || m.extractedName,
          quantity: m.quantity || 1
        }))
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-4 w-4 text-yellow-300" />
            <span>AI Prescription OCR & Smart Ordering</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Order Medicines — Scan Prescription
          </h1>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            Upload doctor prescriptions in image or PDF format. Our Gemini Multimodal AI extracts handwritten medicine names, normalizes them against our inventory, and lets you order instantly.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload & Preview Section */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
              <Upload className="h-5 w-5 text-blue-600" />
              <span>Upload Prescription</span>
            </h2>

            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center transition-all bg-slate-50/50 relative">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              />
              {previewUrl ? (
                <div className="space-y-3">
                  <img
                    src={previewUrl}
                    alt="Prescription preview"
                    className="max-h-56 mx-auto rounded-lg object-contain shadow-sm border border-slate-200"
                  />
                  <p className="text-xs text-slate-500 font-medium">{file?.name}</p>
                </div>
              ) : file ? (
                <div className="py-6 space-y-2">
                  <FileText className="h-12 w-12 text-blue-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">{file.name}</p>
                  <p className="text-xs text-slate-400">PDF Document Ready</p>
                </div>
              ) : (
                <div className="py-8 space-y-3">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Click or drag prescription here</p>
                    <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, WEBP, or PDF</p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-700 text-sm">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={loading || !file}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Analyzing with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-yellow-300" />
                  <span>Extract Medicines with AI</span>
                </>
              )}
            </button>

            {loading && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-center space-y-2">
                <p className="text-xs font-semibold text-blue-700 animate-pulse">{stageMessage}</p>
                <div className="w-full bg-blue-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full w-2/3 animate-pulse rounded-full" />
                </div>
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-xs text-amber-900 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-amber-800">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              <span>AI Extraction Disclaimer</span>
            </div>
            <p className="leading-relaxed">
              Always review extracted medicine names and dosages against your physical prescription before placing an order.
            </p>
          </div>
        </div>

        {/* Extracted Medicines Results Section */}
        <div className="lg:col-span-7 space-y-6">
          {analyzed ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <span>Extracted Medicines</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Verify and edit dosage or quantities before proceeding to pharmacy search.
                  </p>
                </div>
                <button
                  onClick={handleAddMedicine}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center space-x-1 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Medicine</span>
                </button>
              </div>

              {summary && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">Prescription Summary:</p>
                  <p>{summary}</p>
                </div>
              )}

              {/* Table of Medicines */}
              <div className="space-y-4">
                {medicines.map((med, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-slate-200 hover:border-blue-300 rounded-xl bg-slate-50/50 space-y-3 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 pr-4">
                        <div className="flex items-center space-x-2">
                          <Pill className="h-4 w-4 text-blue-600" />
                          <input
                            type="text"
                            value={med.extractedName}
                            onChange={(e) => handleUpdateMedicine(idx, 'extractedName', e.target.value)}
                            className="font-bold text-slate-800 text-sm bg-white border border-slate-200 rounded-md px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        {med.matchedMedicineName ? (
                          <div className="flex items-center space-x-2 text-xs">
                            <span className="bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded">
                              Matched: {med.matchedMedicineName}
                            </span>
                            <span className="text-slate-400 font-semibold">
                              ({med.confidenceScore}% Confidence)
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
                            Unmatched — Will search by custom name
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemoveMedicine(idx)}
                        className="text-slate-400 hover:text-red-600 p-1 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-200/60">
                      <div>
                        <label className="text-slate-500 font-medium block mb-1">Dosage</label>
                        <input
                          type="text"
                          value={med.dosage}
                          onChange={(e) => handleUpdateMedicine(idx, 'dosage', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 font-medium block mb-1">Frequency</label>
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => handleUpdateMedicine(idx, 'frequency', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 font-medium block mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={med.quantity}
                          onChange={(e) => handleUpdateMedicine(idx, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={handleOrderNow}
                  disabled={medicines.length === 0}
                  className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center space-x-3"
                >
                  <span>Search Nearby Pharmacies & Order</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <FileText className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">No Prescription Analyzed Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Upload a handwritten prescription image or PDF on the left and click "Extract Medicines with AI" to get started.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrescriptionScanner;
