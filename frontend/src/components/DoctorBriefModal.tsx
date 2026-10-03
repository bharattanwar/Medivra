import { useState, useEffect } from 'react';
import { 
  X, User, Activity, Pill, AlertCircle, 
  FileText, TrendingUp, TrendingDown, Minus, Shield, Loader2
} from 'lucide-react';
import { journeyService, type DoctorBrief } from '../services/journey';

interface DoctorBriefModalProps {
  patientId: string;
  patientName?: string;
  onClose: () => void;
}

export default function DoctorBriefModal({ patientId, patientName, onClose }: DoctorBriefModalProps) {
  const [brief, setBrief] = useState<DoctorBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'medications' | 'labTrends' | 'history'>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    fetchBrief();
  }, [patientId]);

  const fetchBrief = async () => {
    try {
      setLoading(true);
      const data = await journeyService.getDoctorBrief(patientId);
      setBrief(data);
    } catch (err) {
      console.error('Failed to load doctor brief', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-scale-in">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-6 text-white flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-blue-500/30 text-blue-200 rounded-full text-xs font-semibold flex items-center gap-1 border border-blue-400/20">
                <Shield className="h-3 w-3" /> Pre-Consultation Clinical Brief
              </span>
            </div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <User className="h-6 w-6 text-blue-300" />
              {brief?.patientName || patientName || 'Patient Brief'}
            </h2>
            <p className="text-blue-200 text-xs mt-0.5">
              Deterministic medical summary • Objective intake confirmation • Lab telemetry
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="h-4 w-4" /> Clinical Overview
          </button>
          <button
            onClick={() => setActiveTab('medications')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'medications' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Pill className="h-4 w-4" /> Treatment & Adherence
          </button>
          <button
            onClick={() => setActiveTab('labTrends')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'labTrends' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="h-4 w-4" /> Lab Trends ({brief?.labTrends?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="h-4 w-4" /> Last Consultation
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-medium">Assembling clinical brief...</p>
            </div>
          ) : brief ? (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Active Diagnosis Card */}
                  <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Active Care Plan</span>
                      {brief.activeTreatmentPlan && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
                          {brief.activeTreatmentPlan.status}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {brief.activeDiagnosis || 'No active treatment plan recorded'}
                    </h3>
                    {brief.activeTreatmentPlan && (
                      <p className="text-xs text-slate-600 mt-1">
                        Started: <strong>{brief.treatmentStartDate}</strong> • Follow-up target: <strong>{brief.targetFollowUpDate || 'None set'}</strong>
                      </p>
                    )}
                  </div>

                  {/* Objective Dose Adherence Metrics */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      Patient-Confirmed Medication Logs (Objective Data)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500">Scheduled Doses</p>
                        <p className="text-xl font-black text-slate-900">{brief.totalDosesScheduled}</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm">
                        <p className="text-xs text-emerald-600 font-medium">Confirmed Taken</p>
                        <p className="text-xl font-black text-emerald-700">{brief.dosesConfirmedTaken}</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-sm">
                        <p className="text-xs text-rose-600 font-medium">Marked Skipped</p>
                        <p className="text-xl font-black text-rose-700">{brief.dosesMarkedSkipped}</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500">Pending / Unreported</p>
                        <p className="text-xl font-black text-slate-600">{brief.dosesNotReported}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-200">
                      📋 <strong>Clinical Note:</strong> {brief.adherenceSummaryNote}
                    </p>
                  </div>

                  {/* Pending Lab Tests & Actions */}
                  {brief.pendingLabTests && brief.pendingLabTests.length > 0 && (
                    <div className="border border-amber-200 bg-amber-50/60 rounded-2xl p-4">
                      <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-amber-600" /> Prescribed Diagnostics Pending
                      </h4>
                      <div className="space-y-1.5">
                        {brief.pendingLabTests.map((t, idx) => (
                          <div key={idx} className="bg-white px-3 py-2 rounded-xl text-xs flex justify-between items-center border border-amber-100">
                            <span className="font-semibold text-slate-800">{t.testName}</span>
                            <span className="text-slate-500">Due: {t.dueDate || 'Soon'} ({t.status})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'medications' && (
                <div className="space-y-4">
                  {brief.activeTreatmentPlan?.medications && brief.activeTreatmentPlan.medications.length > 0 ? (
                    brief.activeTreatmentPlan.medications.map((m) => (
                      <div key={m.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <Pill className="h-4 w-4 text-blue-600" /> {m.medicineName} {m.strength ? `(${m.strength})` : ''}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Dosage: <strong>{m.dosage}</strong> • Frequency: <strong>{m.frequency}</strong> • Course: <strong>{m.totalDays} days</strong>
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">Instructions: {m.instructions}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100">
                            Day {m.dayNumber || 1} of {m.totalDays}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Pill className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">No structured medications in active plan</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'labTrends' && (
                <div className="space-y-6">
                  {brief.labTrends && brief.labTrends.length > 0 ? (
                    (() => {
                      const categories = Array.from(new Set(brief.labTrends.map(t => t.testCategory || 'General Lab Panel')));
                      const activeCategory = selectedCategory && categories.includes(selectedCategory) ? selectedCategory : categories[0];
                      const currentCategoryTrends = (brief.labTrends || []).filter(t => (t.testCategory || 'General Lab Panel') === activeCategory);
                      const abnormalTrends = currentCategoryTrends.filter(t => t.latestFlag === 'HIGH' || t.latestFlag === 'LOW' || t.latestFlag === 'CRITICAL_HIGH' || t.latestFlag === 'CRITICAL_LOW');
                      const latestDate = currentCategoryTrends[0]?.latestDate || 'Recent';

                      return (
                        <div className="space-y-4">
                          {/* Test Category Tabs */}
                          {categories.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-100">
                              {categories.map(cat => {
                                const catTrends = (brief.labTrends || []).filter(t => (t.testCategory || 'General Lab Panel') === cat);
                                const catAbnormals = catTrends.filter(t => t.latestFlag === 'HIGH' || t.latestFlag === 'LOW' || t.latestFlag === 'CRITICAL_HIGH' || t.latestFlag === 'CRITICAL_LOW').length;

                                return (
                                  <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                                      activeCategory === cat
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    <span>{cat}</span>
                                    {catAbnormals > 0 && (
                                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                        activeCategory === cat ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
                                      }`}>
                                        {catAbnormals}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Active Test Panel Header */}
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                                🧪 {activeCategory}
                              </h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">Recorded: <strong>{latestDate}</strong></p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {abnormalTrends.length > 0 ? (
                                <span className="px-2.5 py-1 bg-rose-100 text-rose-700 font-bold rounded-xl text-[11px] border border-rose-200">
                                  {abnormalTrends.length} Out of Range
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-bold rounded-xl text-[11px] border border-emerald-200">
                                  ✓ All In Range
                                </span>
                              )}
                              <span className="px-2.5 py-1 bg-white text-slate-600 font-semibold rounded-xl text-[11px] border border-slate-200">
                                {currentCategoryTrends.length} Parameters
                              </span>
                            </div>
                          </div>

                          {/* Variance Comparison Table - ONLY Abnormal Parameters */}
                          {(() => {
                            const isAbnormalFlag = (flag?: string) => {
                              if (!flag) return false;
                              const f = flag.toUpperCase();
                              return f === 'HIGH' || f === 'LOW' || f === 'CRITICAL_HIGH' || f === 'CRITICAL_LOW' || f === 'ABNORMAL';
                            };

                            const abnormalOrVarianceTrends = currentCategoryTrends.filter(t => 
                              isAbnormalFlag(t.latestFlag) || isAbnormalFlag(t.previousFlag)
                            );

                            if (abnormalOrVarianceTrends.length === 0) {
                              return (
                                <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-6 text-center shadow-xs">
                                  <h5 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide">✓ All Parameters In Normal Range</h5>
                                  <p className="text-[11px] text-emerald-800 mt-1">
                                    All {currentCategoryTrends.length} measured parameters for {activeCategory} fall within standard reference intervals.
                                  </p>
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-2">
                                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                          <th className="px-4 py-3">Abnormal / Tracked Parameter</th>
                                          <th className="px-3 py-3">Baseline</th>
                                          <th className="px-3 py-3">Latest Value</th>
                                          <th className="px-3 py-3">Variance / Transition</th>
                                          <th className="px-4 py-3">Reference Range</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {abnormalOrVarianceTrends.map((trend, idx) => (
                                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-4 py-3 font-bold text-slate-900">
                                              {trend.parameterName}
                                            </td>
                                            <td className="px-3 py-3 text-slate-500 font-medium">
                                              {trend.previousValue !== undefined && trend.previousValue !== null ? (
                                                <span>{trend.previousRawValue} {trend.unit || ''}</span>
                                              ) : (
                                                <span className="text-slate-400 italic text-[11px]">—</span>
                                              )}
                                            </td>
                                            <td className="px-3 py-3">
                                              <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                                                trend.latestFlag === 'HIGH' || trend.latestFlag === 'CRITICAL_HIGH'
                                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                  : trend.latestFlag === 'LOW'
                                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                              }`}>
                                                {trend.latestRawValue} {trend.unit || ''}
                                              </span>
                                            </td>
                                            <td className="px-3 py-3">
                                              {trend.previousValue !== undefined && trend.previousValue !== null && trend.deltaPercentage !== undefined && trend.deltaPercentage !== 0 ? (
                                                <span className={`font-bold flex items-center gap-1 ${
                                                  trend.trendDirection === 'INCREASED' ? 'text-blue-600' :
                                                  trend.trendDirection === 'DECREASED' ? 'text-purple-600' : 'text-slate-600'
                                                }`}>
                                                  {trend.trendDirection === 'INCREASED' ? <TrendingUp className="h-3 w-3" /> :
                                                   trend.trendDirection === 'DECREASED' ? <TrendingDown className="h-3 w-3" /> :
                                                   <Minus className="h-3 w-3 text-slate-400" />}
                                                  {trend.deltaPercentage !== undefined ? `${Math.abs(trend.deltaPercentage)}%` : ''}
                                                  <span className="text-[10px] text-slate-400 font-normal">({trend.statusTransition})</span>
                                                </span>
                                              ) : (
                                                <span className="text-[11px] text-slate-400 font-normal">Baseline Reading</span>
                                              )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 font-medium text-[11px]">
                                              {trend.referenceRangeText || 'Standard'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {currentCategoryTrends.length > abnormalOrVarianceTrends.length && (
                                  <div className="px-3 py-2 bg-slate-50 rounded-xl text-center text-[11px] text-slate-500 border border-slate-100">
                                    ✓ {currentCategoryTrends.length - abnormalOrVarianceTrends.length} other routine parameters are normal and within standard ranges.
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Activity className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">No structured lab records uploaded yet</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Previous Consultation</h4>
                    <p className="text-sm font-bold text-slate-800">
                      {brief.lastConsultationDate ? `Consultation on ${brief.lastConsultationDate}` : 'No previous consultation on record'}
                    </p>
                    {brief.lastDoctorName && (
                      <p className="text-xs text-blue-600 font-semibold mt-0.5">Physician: {brief.lastDoctorName}</p>
                    )}
                    
                    {brief.lastDoctorNotes && (
                      <div className="mt-3 bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700">
                        <p className="font-bold text-slate-900 mb-1">Clinical Notes:</p>
                        <p>{brief.lastDoctorNotes}</p>
                      </div>
                    )}

                    {brief.lastPrescriptionSummary && (
                      <div className="mt-3 bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700">
                        <p className="font-bold text-slate-900 mb-1">Prescription Items:</p>
                        <p className="font-mono text-slate-800">{brief.lastPrescriptionSummary}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm">Failed to assemble brief.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md"
          >
            Close Brief
          </button>
        </div>

      </div>
    </div>
  );
}
