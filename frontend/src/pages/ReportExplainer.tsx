import React, { useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { aiService, type ReportAnalysisResponse } from '../services/ai';

export default function ReportExplainer() {
  const patientId = localStorage.getItem("userId");
  const [file, setFile] = useState<File | null>(null);
  const [reportType, setReportType] = useState<string>('Blood Test');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ReportAnalysisResponse | null>(null);
  const [history, setHistory] = useState<ReportAnalysisResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patientId) {
      loadHistory();
    }
  }, [patientId]);

  const loadHistory = async () => {
    try {
      const data = await aiService.getReportsByPatient(patientId!);
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !patientId) return;

    setAnalyzing(true);
    setError(null);
    try {
      const data = await aiService.analyzeReport(patientId!, reportType, file);
      setResult(data);
      loadHistory();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to analyze report');
    } finally {
      setAnalyzing(false);
    }
  };

  const parseJsonList = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reports Result</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload medical reports to view abnormal and normal test findings instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Section */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Upload New Report</h2>
            <form onSubmit={handleAnalyze} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                >
                  <option>Blood Test</option>
                  <option>MRI</option>
                  <option>CT Scan</option>
                  <option>X-Ray</option>
                  <option>ECG</option>
                  <option>Prescription</option>
                  <option>Discharge Summary</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Document</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                        <span>Upload a file</span>
                        <input type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,image/*" />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PDF, PNG, JPG up to 10MB</p>
                  </div>
                </div>
                {file && <p className="mt-2 text-sm text-gray-600">Selected: {file.name}</p>}
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!file || analyzing}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 cursor-pointer"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Analyzing...
                  </>
                ) : (
                  'Analyze Report'
                )}
              </button>
            </form>
          </div>

          {/* History */}
          <div className="mt-8 bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Past Analyses</h2>
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.reportId}
                  onClick={() => setResult(item)}
                  className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.reportType}</p>
                      <p className="text-xs text-gray-500">{new Date(item.analyzedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No previous analyses</p>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-2">
          {result ? (
            <div className="space-y-6">
              {/* Disclaimer & Confidence Header */}
              <div className="bg-white shadow rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-indigo-500">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Report Findings</h3>
                  <p className="text-xs text-gray-500">AI analysis result for {result.reportType || 'uploaded document'}</p>
                </div>
                <span className={`self-start sm:self-auto px-3 py-1 text-xs rounded-full font-bold ${
                  result.confidenceLevel === 'HIGH' ? 'bg-green-100 text-green-800' :
                  result.confidenceLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {result.confidenceLevel} Confidence
                </span>
              </div>

              {/* 1. Abnormal Findings */}
              <div className="bg-white shadow rounded-lg p-6 border-t-4 border-red-500">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2 shrink-0" />
                  Abnormal Findings
                </h4>
                {parseJsonList(result.abnormalFindings).length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No abnormal findings detected.</p>
                ) : (
                  <ul className="space-y-3">
                    {parseJsonList(result.abnormalFindings).map((item: string, i: number) => (
                      <li key={i} className="text-sm text-gray-800 flex items-start bg-red-50/50 p-3 rounded-lg border border-red-100">
                        <span className="text-red-500 font-bold mr-2">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 2. Normal Findings */}
              <div className="bg-white shadow rounded-lg p-6 border-t-4 border-green-500">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                  Normal Findings
                </h4>
                {parseJsonList(result.normalFindings).length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No normal findings listed.</p>
                ) : (
                  <ul className="space-y-3">
                    {parseJsonList(result.normalFindings).map((item: string, i: number) => (
                      <li key={i} className="text-sm text-gray-800 flex items-start bg-green-50/50 p-3 rounded-lg border border-green-100">
                        <span className="text-green-500 font-bold mr-2">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Medical Disclaimer */}
              <p className="text-xs text-gray-400 text-center py-2">
                Disclaimer: AI-generated explanation for informational purposes only. Consult a physician for medical advice.
              </p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-12 text-center text-gray-500 flex flex-col items-center justify-center h-full min-h-[400px]">
              <FileText className="h-16 w-16 text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-900">No report selected</p>
              <p className="mt-1">Upload a report or select one from your history to view the AI analysis.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
