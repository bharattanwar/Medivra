import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileText, AlertTriangle, CheckCircle2, ArrowRight, Loader2,
  ChevronDown, ChevronUp, Brain, Stethoscope, ShoppingBag,
  Activity, Sparkles, ClipboardList, HelpCircle, Clock, RefreshCw, X, Trash2
} from 'lucide-react';
import { aiService, type ReportAnalysisResponse } from '../services/ai';

/* ─────────────────────────── helpers ─────────────────────────── */

/**
 * Parse a JSON string that may be a list of strings OR list of objects.
 * Also handles newline/bullet separated plain text.
 */
const parseList = (raw: string): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) =>
        typeof item === 'string' ? item : JSON.stringify(item)
      );
    }
    return [];
  } catch {
    if (typeof raw === 'string' && raw.trim()) {
      return raw.split('\n').map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    }
    return [];
  }
};

interface FindingRow {
  parameter: string;
  value: string;
  status: 'abnormal' | 'normal';
  detail: string;
}

const buildFindingRows = (abnormal: string[], normal: string[]): FindingRow[] => {
  const rows: FindingRow[] = [];
  const parse = (line: string, status: 'abnormal' | 'normal') => {
    const colMatch = line.match(/^(.+?)[:—\-–]\s*(.+)$/);
    if (colMatch) {
      rows.push({ parameter: colMatch[1].trim(), value: colMatch[2].trim(), status, detail: line });
    } else {
      rows.push({ parameter: line, value: '—', status, detail: line });
    }
  };
  abnormal.forEach(l => parse(l, 'abnormal'));
  normal.forEach(l => parse(l, 'normal'));
  return rows;
};

const CONFIDENCE_STYLE: Record<string, string> = {
  HIGH: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border border-amber-200',
  LOW: 'bg-red-100 text-red-700 border border-red-200',
};

const REPORT_TYPES = [
  'Blood Test', 'Complete Blood Count (CBC)', 'Lipid Panel', 'Liver Function Test',
  'Kidney Function Test', 'Thyroid Panel', 'Diabetes / HbA1c',
  'MRI', 'CT Scan', 'X-Ray', 'Ultrasound', 'ECG / EKG',
  'Urine Analysis', 'Prescription', 'Discharge Summary', 'Other',
];

/* ─────────────────────────── component ─────────────────────────── */

export default function ReportExplainer() {
  const patientId = localStorage.getItem('userId');
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [reportType, setReportType] = useState('Blood Test');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ReportAnalysisResponse | null>(null);
  const [history, setHistory] = useState<ReportAnalysisResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(true);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [loopBannerVisible, setLoopBannerVisible] = useState(false);

  useEffect(() => {
    if (patientId) loadHistory();
  }, [patientId]);

  useEffect(() => {
    if (result) {
      setLoopBannerVisible(false);
      const t = setTimeout(() => setLoopBannerVisible(true), 1000);
      return () => clearTimeout(t);
    }
  }, [result]);

  const loadHistory = async () => {
    try {
      const data = await aiService.getReportsByPatient(patientId!);
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history', err);
    }
  };

  const handleDeleteReport = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this report from your history?")) {
      return;
    }
    try {
      await aiService.deleteReport(reportId);
      setHistory(prev => prev.filter(r => r.reportId !== reportId));
      if (result?.reportId === reportId) {
        setResult(null);
      }
    } catch (err) {
      console.error('Failed to delete report', err);
      alert('Failed to delete report. Please try again.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !patientId) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setLoopBannerVisible(false);
    try {
      const data = await aiService.analyzeReport(patientId, reportType, file);
      setResult(data);
      loadHistory();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to analyze report. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleBookDoctor = () => {
    if (!result) return;
    const abnormals = parseList(result.abnormalFindings);
    const context = abnormals.length > 0
      ? `Based on my ${result.reportType} report, I have these abnormal findings: ${abnormals.slice(0, 4).join('; ')}.`
      : `I need a consultation after reviewing my ${result.reportType} report.`;
    navigate('/patient/ai/booking', { state: { prefillSymptoms: context } });
  };

  const handleOrderMedicines = () => {
    if (!result) return;
    const abnormals = parseList(result.abnormalFindings);
    navigate('/patient/pharmacy', {
      state: {
        reportFindings: abnormals,
        reportType: result.reportType,
        summary: result.summaryText
      }
    });
  };

  /* ── derived data ── */
  const abnormals = result ? parseList(result.abnormalFindings) : [];
  const normals = result ? parseList(result.normalFindings) : [];
  const questions = result ? parseList(result.suggestedQuestions) : [];
  const followUps = result ? parseList(result.recommendedFollowUps) : [];
  const rows = result ? buildFindingRows(abnormals, normals) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">AI Report Explainer</h1>
          </div>
          <p className="text-slate-500 ml-[52px]">
            Upload your medical report — our AI reads it and tells you exactly what it means, in plain language.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ══════ LEFT PANEL ══════ */}
          <div className="lg:col-span-4 space-y-5">

            {/* Upload card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-500" />
                Upload Report
              </h2>
              <form onSubmit={handleAnalyze} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Report Type
                  </label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  >
                    {REPORT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all duration-200 ${
                    dragOver
                      ? 'border-blue-400 bg-blue-50 scale-[1.02]'
                      : file
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    onChange={handleFileChange}
                    accept=".pdf,image/*"
                  />
                  {file ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-emerald-700 break-all">{file.name}</p>
                        <p className="text-xs text-emerald-500 mt-0.5">
                          {(file.size / 1024).toFixed(0)} KB · Click to change
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Upload className="w-6 h-6 text-blue-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-700">Drop your report here</p>
                        <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG · up to 10 MB</p>
                      </div>
                    </>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!file || analyzing}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 transition-all duration-200 cursor-pointer"
                >
                  {analyzing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Analyzing with AI…</>
                  ) : (
                    <><Sparkles className="w-4 h-4" />Analyze Report</>
                  )}
                </button>
              </form>
            </div>

            {/* History card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Past Analyses
                {history.length > 0 && (
                  <span className="ml-auto text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {history.length}
                  </span>
                )}
              </h2>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {history.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">No previous analyses yet.</p>
                )}
                {history.map((item) => (
                  <div
                    key={item.reportId}
                    className="group relative flex items-center"
                  >
                    <button
                      onClick={() => { setResult(item); setLoopBannerVisible(false); setTimeout(() => setLoopBannerVisible(true), 600); }}
                      className={`flex-1 text-left flex items-center gap-3 p-3 rounded-xl transition-all mr-8 border cursor-pointer ${
                        result?.reportId === item.reportId
                          ? 'bg-blue-50 border-blue-200'
                          : 'hover:bg-slate-50 border-transparent'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        result?.reportId === item.reportId ? 'bg-blue-100' : 'bg-slate-100'
                      }`}>
                        <FileText className={`w-4 h-4 ${result?.reportId === item.reportId ? 'text-blue-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.reportType}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(item.analyzedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteReport(item.reportId, e)}
                      className="absolute right-2 p-2 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer shrink-0"
                      title="Delete analysis history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ══════ RIGHT PANEL ══════ */}
          <div className="lg:col-span-8 space-y-5">

            {!result && !analyzing && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 flex flex-col items-center justify-center text-center min-h-[420px]">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-5">
                  <Activity className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Upload a Report to Get Started</h3>
                <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                  Our AI will read your report and give you a clear, plain-language breakdown — along with what to do next.
                </p>
                <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-sm">
                  {[
                    { icon: Brain, label: 'AI Analysis', color: 'text-blue-500 bg-blue-50' },
                    { icon: AlertTriangle, label: 'Flag Abnormals', color: 'text-amber-500 bg-amber-50' },
                    { icon: Stethoscope, label: 'Book a Doctor', color: 'text-emerald-500 bg-emerald-50' },
                  ].map(({ icon: Icon, label, color }) => (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-slate-500">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analyzing && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 flex flex-col items-center justify-center min-h-[420px]">
                <div className="relative w-20 h-20 mb-6">
                  <div className="w-20 h-20 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Brain className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">AI is reading your report…</h3>
                <p className="text-sm text-slate-400 mb-6">This usually takes 10–20 seconds</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['Extracting data', 'Identifying findings', 'Generating summary'].map((step) => (
                    <span key={step} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full font-medium">
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result && (
              <>
                {/* Report Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-blue-200" />
                        <span className="text-blue-200 text-xs font-semibold uppercase tracking-widest">Report Analysis</span>
                      </div>
                      <h2 className="text-xl font-bold">{result.reportType}</h2>
                      <p className="text-blue-200 text-sm mt-0.5">
                        Analyzed {new Date(result.analyzedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${CONFIDENCE_STYLE[result.confidenceLevel] || CONFIDENCE_STYLE.MEDIUM}`}>
                        {result.confidenceLevel} Confidence
                      </span>
                      {abnormals.length > 0 && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600 border border-red-200">
                          {abnormals.length} Abnormal {abnormals.length === 1 ? 'Finding' : 'Findings'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Findings Table */}
                {rows.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 pt-5 pb-3 border-b border-slate-100">
                      <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-slate-400" />
                        Test Parameters
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Parameter</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Result / Detail</th>
                            <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rows.map((row, i) => (
                            <tr key={i} className={`transition-colors ${row.status === 'abnormal' ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-slate-50'}`}>
                              <td className="px-6 py-3.5 font-semibold text-slate-800">{row.parameter}</td>
                              <td className="px-4 py-3.5 text-slate-600 max-w-xs">
                                {row.value !== '—' ? row.value : <span className="text-slate-400 italic text-xs">{row.detail}</span>}
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                {row.status === 'abnormal' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600 border border-red-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    Abnormal
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-600 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Normal
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Plain-language Summary */}
                {result.summaryText && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => setShowSummary(!showSummary)}
                      className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        What Does This Mean? (Plain Language)
                      </span>
                      {showSummary ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </button>
                    {showSummary && (
                      <div className="px-6 pb-5 pt-1">
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{result.summaryText}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Questions to ask doctor */}
                {questions.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => setShowQuestions(!showQuestions)}
                      className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-amber-500" />
                        Questions to Ask Your Doctor
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-bold border border-amber-200">{questions.length}</span>
                      </span>
                      {showQuestions ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </button>
                    {showQuestions && (
                      <ul className="px-6 pb-5 pt-1 space-y-2.5">
                        {questions.map((q, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                            {q}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Recommended Follow-ups */}
                {followUps.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => setShowFollowUp(!showFollowUp)}
                      className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-indigo-500" />
                        Recommended Follow-ups
                      </span>
                      {showFollowUp ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </button>
                    {showFollowUp && (
                      <ul className="px-6 pb-5 pt-1 space-y-2.5">
                        {followUps.map((fu, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                            {fu}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* ── Healthcare Loop CTA Banner ── */}
                {loopBannerVisible && (
                  <div
                    className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 shadow-2xl border border-slate-700 overflow-hidden"
                    style={{ animation: 'slideUp 0.4s ease-out' }}
                  >
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-600/20 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-600/20 rounded-full blur-2xl pointer-events-none" />

                    <button
                      onClick={() => setLoopBannerVisible(false)}
                      className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Healthcare Loop</span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">What would you like to do next?</h3>
                      {abnormals.length > 0 ? (
                        <p className="text-sm text-slate-400 mb-5">
                          Your report shows <span className="text-red-400 font-semibold">{abnormals.length} abnormal finding{abnormals.length > 1 ? 's' : ''}</span>. Our AI can find the right specialist for you instantly.
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400 mb-5">
                          Your report looks good! You can still consult a doctor or browse medicines.
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          onClick={handleBookDoctor}
                          className="group flex items-center gap-4 bg-blue-600 hover:bg-blue-500 rounded-2xl p-5 transition-all duration-200 shadow-xl shadow-blue-950/50 border border-blue-500/30 cursor-pointer"
                        >
                          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                            <Stethoscope className="w-6 h-6 text-white" />
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-base font-bold text-white">Book a Doctor</p>
                            <p className="text-xs text-blue-200 mt-0.5 leading-relaxed">AI finds the right specialist for your report findings</p>
                          </div>
                          <ArrowRight className="w-5 h-5 text-blue-300 shrink-0 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                          onClick={handleOrderMedicines}
                          className="group flex items-center gap-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl p-5 transition-all duration-200 shadow-xl shadow-emerald-950/50 border border-emerald-500/30 cursor-pointer"
                        >
                          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                            <ShoppingBag className="w-6 h-6 text-white" />
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-base font-bold text-white">Order Medicines</p>
                            <p className="text-xs text-emerald-200 mt-0.5 leading-relaxed">Order recommended medicines & supplements based on report deficiencies</p>
                          </div>
                          <ArrowRight className="w-5 h-5 text-emerald-300 shrink-0 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-400 text-center py-2 px-4">
                  ⚠️ AI-generated for informational purposes only. Always consult a licensed physician for medical decisions.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

