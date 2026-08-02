import React, { useState, useEffect } from 'react';
import { Activity, Clock, FileText, CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { aiService, type FollowUpPlan, type FollowUpProgressResponse, type FollowUpCheckInResponse } from '../services/ai';

export default function FollowUpTracker() {
  const patientId = localStorage.getItem("userId"); const [plans, setPlans] = useState<FollowUpPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<FollowUpPlan | null>(null);
  const [progress, setProgress] = useState<FollowUpProgressResponse | null>(null);
  const [checkIns, setCheckIns] = useState<FollowUpCheckInResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // New Check-in state
  const [fever, setFever] = useState('Stable');
  const [pain, setPain] = useState('Stable');
  const [missedMedicine, setMissedMedicine] = useState('No');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (patientId) {
      loadPlans();
    }
  }, [patientId]);

  const loadPlans = async () => {
    try {
      const data = await aiService.getPlansByPatient(patientId!);
      setPlans(data);
      if (data.length > 0) {
        handleSelectPlan(data[0]);
      }
    } catch (err) {
      console.error('Failed to load follow up plans', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan: FollowUpPlan) => {
    setSelectedPlan(plan);
    try {
      const [progData, checkInsData] = await Promise.all([
        aiService.getProgressSummary(plan.id),
        aiService.getCheckInsForPlan(plan.id)
      ]);
      setProgress(progData);
      setCheckIns(checkInsData);
    } catch (err) {
      console.error('Failed to load plan details', err);
    }
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    setSubmitting(true);
    try {
      const dayNumber = checkIns.length + 1;
      await aiService.processCheckIn({
        planId: selectedPlan.id,
        dayNumber,
        responses: {
          'Fever Status': fever,
          'Pain Level': pain,
          'Missed Medicine': missedMedicine
        }
      });
      // Reload
      await handleSelectPlan(selectedPlan);
    } catch (err) {
      console.error('Failed to submit check in', err);
      alert('Failed to submit check-in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const parseMedicines = (jsonStr: string) => {
    try {
      return JSON.parse(jsonStr);
    } catch {
      return [];
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Activity className="animate-pulse h-10 w-10 text-indigo-500" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">AI Follow-Up & Recovery Monitor</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track your recovery progress and receive AI-guided recommendations based on your daily check-ins.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar: Plans List */}
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Your Recovery Plans</h2>
          {plans.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p>No active follow-up plans.</p>
              <p className="text-xs mt-1">Plans are created by your doctor after a consultation.</p>
            </div>
          ) : (
            plans.map(plan => (
              <div
                key={plan.id}
                onClick={() => handleSelectPlan(plan)}
                className={`bg-white shadow rounded-lg p-5 cursor-pointer border-l-4 transition-all ${selectedPlan?.id === plan.id ? 'border-indigo-500 ring-1 ring-indigo-200' :
                    plan.status === 'ACTIVE' ? 'border-green-400 hover:bg-gray-50' :
                      plan.status === 'ESCALATED' ? 'border-red-500 hover:bg-gray-50' :
                        'border-gray-300 hover:bg-gray-50 opacity-75'
                  }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-md font-bold text-gray-900 line-clamp-1">{plan.diagnosis || 'Post-Consultation Monitoring'}</h3>
                    <p className="text-xs text-gray-500 mt-1 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date(plan.startDate).toLocaleDateString()} to {new Date(plan.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${plan.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      plan.status === 'ESCALATED' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                    {plan.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-indigo-600 font-medium">
                    {plan.followUpIntervalDays} Day Plan
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Content: Plan Details & Check-ins */}
        <div className="lg:col-span-8">
          {selectedPlan ? (
            <div className="space-y-6">

              {/* Progress Summary Card */}
              {progress && (
                <div className="bg-white shadow rounded-lg p-6 border-t-4 border-indigo-500 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                    <Activity className="h-24 w-24 text-indigo-900" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Activity className="h-5 w-5 text-indigo-500 mr-2" />
                    AI Progress Summary
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-md p-4 border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase">Recovery Trend</p>
                      <p className={`mt-1 text-lg font-bold flex items-center ${progress.recoveryTrend === 'IMPROVING' ? 'text-green-600' :
                          progress.recoveryTrend === 'WORSENING' ? 'text-red-600' :
                            'text-yellow-600'
                        }`}>
                        {progress.recoveryTrend === 'IMPROVING' && <CheckCircle className="h-4 w-4 mr-1" />}
                        {progress.recoveryTrend === 'WORSENING' && <AlertTriangle className="h-4 w-4 mr-1" />}
                        {progress.recoveryTrend}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-md p-4 border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase">Adherence</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">{progress.adherencePercentage.toFixed(0)}%</p>
                    </div>
                    <div className="bg-gray-50 rounded-md p-4 border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase">Day</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">{checkIns.length} of {selectedPlan.followUpIntervalDays}</p>
                    </div>
                  </div>

                  <div className="bg-indigo-50 rounded-md p-4 border border-indigo-100">
                    <p className="text-sm text-indigo-900">
                      <strong>AI Insights:</strong> {progress.overallProgressSummary}
                    </p>
                  </div>
                </div>
              )}

              {/* Today's Check-in Form */}
              {selectedPlan.status === 'ACTIVE' && checkIns.length < selectedPlan.followUpIntervalDays && (
                <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Today's Check-In</h3>
                  <form onSubmit={handleCheckInSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fever Status</label>
                        <select
                          value={fever}
                          onChange={(e) => setFever(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        >
                          <option>Improving / No Fever</option>
                          <option>Stable</option>
                          <option>Worsening / High Fever</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pain Level</label>
                        <select
                          value={pain}
                          onChange={(e) => setPain(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        >
                          <option>Reduced / No Pain</option>
                          <option>Stable</option>
                          <option>Increased Pain</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Missed Medicine?</label>
                        <select
                          value={missedMedicine}
                          onChange={(e) => setMissedMedicine(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        >
                          <option>No</option>
                          <option>Yes, missed 1 dose</option>
                          <option>Yes, missed multiple doses</option>
                        </select>
                      </div>
                    </div>
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                      >
                        {submitting ? 'Submitting...' : 'Submit Daily Check-in'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* History of Check-ins */}
              {checkIns.length > 0 && (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Check-In History</h3>
                  </div>
                  <ul className="divide-y divide-gray-200">
                    {checkIns.map((ci) => {
                      const responses = parseMedicines(ci.responses);
                      return (
                        <li key={ci.id} className="p-6 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center">
                              <span className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mr-3">
                                {ci.dayNumber}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-gray-900">Day {ci.dayNumber}</p>
                                <p className="text-xs text-gray-500">{new Date(ci.createdAt).toLocaleString()}</p>
                              </div>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${ci.actionRecommended === 'CONTINUE' ? 'bg-green-100 text-green-800' :
                                ci.actionRecommended === 'EMERGENCY' ? 'bg-red-100 text-red-800 animate-pulse' :
                                  'bg-yellow-100 text-yellow-800'
                              }`}>
                              Action: {ci.actionRecommended}
                            </span>
                          </div>

                          <div className="ml-11 mt-3">
                            <div className="bg-gray-50 rounded p-3 mb-3 text-sm flex gap-4 text-gray-600 border border-gray-100">
                              {Object.entries(responses).map(([k, v]: any) => (
                                <span key={k}><strong>{k}:</strong> {v}</span>
                              ))}
                            </div>
                            <p className="text-sm text-gray-700 bg-indigo-50 p-3 rounded-md border-l-4 border-indigo-400">
                              <strong>AI Analysis:</strong> {ci.aiAnalysis}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-12 text-center text-gray-500 h-full flex flex-col items-center justify-center min-h-[400px]">
              <Activity className="h-16 w-16 text-gray-200 mb-4" />
              <p className="text-lg font-medium text-gray-900">Select a plan</p>
              <p className="mt-1">Choose a follow-up plan from the left sidebar to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
