import { useState, useEffect } from 'react';
import { X, FileText, Pill, AlertCircle, Loader2, User, Shield } from 'lucide-react';
import api from '../services/api';

interface PrescriptionItem {
  id: string;
  medicineName: string;
  strength?: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface MedicalRecord {
  id: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  filePath: string;
  fileType: string;
  notes?: string;
  createdAt: string;
}

interface ViewPrescriptionModalProps {
  appointmentId: string;
  patientName: string;
  appointmentDate: string;
  timeSlot: string;
  onClose: () => void;
}

export default function ViewPrescriptionModal({
  appointmentId,
  patientName,
  appointmentDate,
  timeSlot,
  onClose,
}: ViewPrescriptionModalProps) {
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPrescription();
  }, [appointmentId]);

  const fetchPrescription = async () => {
    try {
      setLoading(true);
      setError('');
      // 1. Fetch Medical Record for Appointment
      const recordRes = await api.get(`/records/appointment/${appointmentId}`);
      if (recordRes.data && recordRes.data.id) {
        setRecord(recordRes.data);
        // 2. Fetch Prescription Items
        try {
          const itemsRes = await api.get(`/records/${recordRes.data.id}/items`);
          setItems(itemsRes.data || []);
        } catch {
          // Non-critical if items table is empty
        }
      } else {
        setError('No prescription found for this appointment.');
      }
    } catch (err: any) {
      console.error('Failed to fetch prescription', err);
      setError('No prescription recorded for this appointment yet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-scale-in">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-blue-700 to-slate-900 p-6 text-white flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 rounded-full text-xs font-semibold flex items-center gap-1 border border-indigo-400/20">
                <Shield className="h-3 w-3" /> Digital Medical Record
              </span>
            </div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-indigo-300" />
              Prescription for {patientName}
            </h2>
            <p className="text-indigo-200 text-xs mt-0.5 flex items-center gap-3">
              <span>📅 {new Date(appointmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span>⏰ Slot: {timeSlot}</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6" id="prescription-content">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-3" />
              <p className="text-sm font-medium">Loading digital prescription...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center text-amber-800">
              <AlertCircle className="h-8 w-8 text-amber-600 mx-auto mb-2" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : record ? (
            <>
              {/* Patient & Consultation Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{patientName}</p>
                    <p className="text-slate-500">Record ID: {record.id.substring(0, 13)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-200">
                    ✓ Verified E-Prescription
                  </span>
                </div>
              </div>

              {/* Prescribed Medicines Table */}
              {items.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Pill className="h-4 w-4 text-indigo-600" /> Prescribed Medications ({items.length})
                  </h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                          <th className="px-4 py-2.5">Medicine Name</th>
                          <th className="px-4 py-2.5">Strength</th>
                          <th className="px-4 py-2.5">Dosage</th>
                          <th className="px-4 py-2.5">Frequency</th>
                          <th className="px-4 py-2.5">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-3 font-bold text-slate-900">{item.medicineName}</td>
                            <td className="px-4 py-3 text-slate-600">{item.strength || '—'}</td>
                            <td className="px-4 py-3 text-slate-700 font-semibold">{item.dosage}</td>
                            <td className="px-4 py-3 text-slate-700 font-mono">{item.frequency}</td>
                            <td className="px-4 py-3 text-slate-600">{item.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Clinical Advice / Instructions */}
              {record.notes && (
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-950">
                  <p className="font-bold text-indigo-900 mb-1">Doctor's Clinical Notes / Advice:</p>
                  <p className="leading-relaxed whitespace-pre-line">{record.notes}</p>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end items-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
