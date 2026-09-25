import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, Pill, CheckCircle2, Clock, Calendar, FileText, 
  ArrowRight, TrendingUp, TrendingDown, Minus, Stethoscope, 
  RefreshCw, ChevronRight, Shield, Bot, Send, Loader2, Check
} from 'lucide-react';
import { 
  journeyService, 
  type NextActionResponse, 
  type LabTrend, 
  type HealthTimelineEvent, 
  type AiContextResponse
} from '../services/journey';

export default function HealthJourneyDashboard() {
  const navigate = useNavigate();
  const patientId = localStorage.getItem('userId');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextActions, setNextActions] = useState<NextActionResponse | null>(null);
  const [labTrends, setLabTrends] = useState<LabTrend[]>([]);
  const [timeline, setTimeline] = useState<HealthTimelineEvent[]>([]);
  
  // AI Context Assistant Drawer State
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<Array<{ question: string; response: AiContextResponse }>>([]);

  // Filter state for timeline
  const [timelineFilter, setTimelineFilter] = useState<'ALL' | 'CONSULTATION' | 'PRESCRIPTION' | 'LAB_REPORT' | 'CARE_TASK'>('ALL');

  useEffect(() => {
    if (patientId) {
      loadDashboardData();
    }
  }, [patientId]);

  const loadDashboardData = async () => {
    if (!patientId) return;
    try {
      setLoading(true);
      const data = await journeyService.getPatientDashboard(patientId);
      setNextActions(data.nextActions);
      setLabTrends(data.labTrends || []);
      setTimeline(data.recentTimeline || []);
    } catch (err) {
      console.error('Failed to load patient health journey', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!patientId) return;
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleConfirmDose = async (doseLogId: string, status: 'TAKEN' | 'SKIPPED') => {
    if (!patientId) return;
    try {
      await journeyService.confirmDose(doseLogId, status);
      // Reload next actions to refresh state
      const updated = await journeyService.getNextActions(patientId);
      setNextActions(updated);
    } catch (err) {
      console.error('Failed to confirm dose', err);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!patientId) return;
    try {
      await journeyService.completeTask(taskId);
      const updated = await journeyService.getNextActions(patientId);
      setNextActions(updated);
    } catch (err) {
      console.error('Failed to complete task', err);
    }
  };

  const handleAskAi = async (qText?: string) => {
    const prompt = qText || aiQuestion;
    if (!prompt.trim() || !patientId) return;

    setAiLoading(true);
    try {
      const res = await journeyService.askAiHealthContext(patientId, prompt);
      setAiHistory(prev => [...prev, { question: prompt, response: res }]);
      setAiQuestion('');
    } catch (err) {
      console.error('AI query error', err);
    } finally {
      setAiLoading(false);
    }
  };

  const activePlan = nextActions?.activePlan;

  const filteredTimeline = timeline.filter(item => {
    if (timelineFilter === 'ALL') return true;
    return item.eventType === timelineFilter;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-4">
          <div className="h-16 w-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <Activity className="h-7 w-7 text-blue-600 absolute inset-0 m-auto animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Synchronizing Health Journey</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Connecting consultations, active care plans, medication adherence, and lab records...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      
      {/* Top Banner / Active Care Plan Header */}
      <section className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-blue-500/20 text-blue-200 border border-blue-400/20 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-blue-300" /> Patient Health Journey
                </span>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all text-xs flex items-center gap-1"
                  title="Refresh Telemetry"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
                {activePlan ? activePlan.diagnosis : "Your Health Journey"}
              </h1>

              <p className="text-blue-100 text-xs sm:text-sm mt-1.5 max-w-2xl">
                {activePlan ? (
                  <>Under active care with <strong>{activePlan.doctorName || "Your Physician"}</strong> • Started {activePlan.startDate} • Target Review: {activePlan.followUpDate || "Ongoing"}</>
                ) : (
                  <>Track your active care plans, daily medications, lab test diagnostics, and recovery progression.</>
                )}
              </p>
            </div>

            {/* AI Assistant Quick Trigger */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => setAiDrawerOpen(true)}
                className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-5 py-3 rounded-2xl font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all duration-200 active:scale-95"
              >
                <Bot className="h-4 w-4" /> Ask Health Navigator
              </button>
            </div>
          </div>

          {/* Active Plan Progress Bar */}
          {activePlan && (
            <div className="mt-8 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
              <div className="flex justify-between items-center text-xs font-bold mb-2">
                <span className="text-blue-200 uppercase tracking-wider">Treatment Progress</span>
                <span className="text-white">{Math.round(activePlan.progressPercentage)}% Completed</span>
              </div>
              <div className="w-full bg-slate-900/40 rounded-full h-3 overflow-hidden p-0.5 border border-white/10">
                <div 
                  className="bg-gradient-to-r from-emerald-400 to-teal-300 h-full rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${Math.max(5, activePlan.progressPercentage)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-blue-200 mt-2 font-medium">
                <span>{activePlan.completedTasks} of {activePlan.totalTasks} care milestones completed</span>
                <span>{activePlan.totalMedications} active prescribed medicines</span>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* Main Journey Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        
        {/* ═══════════════════════════════════════════════════════════════════
            CORE DIFFERENTIATOR: "WHAT DO I NEED TO DO NEXT?" ACTION ENGINE
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-8 mb-8 relative z-10">
          
          <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">What do I need to do next?</h2>
                <p className="text-xs text-slate-500 mt-0.5">Your actionable care tasks and medication schedule</p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                {nextActions?.takenDosesToday || 0} / {nextActions?.totalDosesToday || 0} Today's Doses Taken
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* COLUMN 1: TODAY'S ACTIONS (Pills & Tasks) */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Today's Medication Schedule
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Click to confirm explicit dose</span>
                </div>

                {nextActions?.todayDoses && nextActions.todayDoses.length > 0 ? (
                  <div className="space-y-2.5">
                    {nextActions.todayDoses.map((dose) => (
                      <div 
                        key={dose.id}
                        className={`p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-4 ${
                          dose.status === 'TAKEN' 
                            ? 'bg-emerald-50/50 border-emerald-200/80 shadow-sm'
                            : dose.status === 'SKIPPED'
                            ? 'bg-rose-50/40 border-rose-200'
                            : 'bg-white border-slate-200 hover:border-blue-300 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                            dose.status === 'TAKEN'
                              ? 'bg-emerald-500 text-white'
                              : dose.status === 'SKIPPED'
                              ? 'bg-rose-500 text-white'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            <Pill className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{dose.medicineName}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {dose.dosage} • <span className="font-semibold text-slate-700">{dose.doseSlot}</span>
                            </p>
                          </div>
                        </div>

                        {/* Explicit Confirm Actions */}
                        <div className="flex items-center gap-2">
                          {dose.status === 'TAKEN' ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200">
                              <Check className="h-3.5 w-3.5" /> Taken
                            </span>
                          ) : dose.status === 'SKIPPED' ? (
                            <span className="text-xs font-bold text-rose-700 bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200">
                              Marked Skipped
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleConfirmDose(dose.id, 'TAKEN')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                              >
                                <Check className="h-3.5 w-3.5" /> Take
                              </button>
                              <button
                                onClick={() => handleConfirmDose(dose.id, 'SKIPPED')}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-semibold transition-all"
                              >
                                Skip
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-1 text-emerald-500" />
                    <p className="text-xs font-bold text-slate-700">All set for today!</p>
                    <p className="text-[11px] text-slate-500">No scheduled medication doses pending for today.</p>
                  </div>
                )}
              </div>

              {/* Today's Care Tasks */}
              {nextActions?.todayTasks && nextActions.todayTasks.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2.5">
                    Today's Care Tasks
                  </h3>
                  <div className="space-y-2">
                    {nextActions.todayTasks.map((task) => (
                      <div key={task.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{task.title}</p>
                          <p className="text-slate-500 text-[11px]">{task.description}</p>
                        </div>
                        {task.status === 'COMPLETED' ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> Done
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCompleteTask(task.id)}
                            className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                          >
                            Mark Done
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* COLUMN 2: NEXT UPCOMING ACTIONS (Lab Tests, Reports, Follow-up) */}
            <div className="lg:col-span-5 space-y-4 lg:border-l lg:border-slate-100 lg:pl-8">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-600" /> Next Documented Actions
              </h3>

              {/* Prescribed Lab Test Card */}
              {nextActions?.pendingLabTests && nextActions.pendingLabTests.length > 0 ? (
                nextActions.pendingLabTests.map((test) => (
                  <div key={test.id} className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                          🧪
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">{test.testName}</h4>
                          <p className="text-xs text-amber-900/70">Prescribed Diagnostic • Due: {test.dueDate || 'Soon'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-amber-200/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">{test.instructions || "Visit lab to complete"}</span>
                      <button
                        onClick={() => navigate('/patient/ai/reports', {
                          state: {
                            fromJourney: true,
                            reportType: test.testName,
                            labTestId: test.id,
                            labTestName: test.testName
                          }
                        })}
                        className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        Upload Report <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              ) : null}

              {/* Follow-up Review Consultation Card */}
              {activePlan?.followUpDate && (
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                      <Stethoscope className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Review Consultation</h4>
                      <p className="text-xs text-blue-900/70">Recommended Target: {activePlan.followUpDate}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 mb-3">
                    Schedule review with <strong>{activePlan.doctorName || "your doctor"}</strong> to evaluate treatment progress.
                  </p>
                  <button
                    onClick={() => navigate('/patient/dashboard')}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    Schedule Review <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Upload Report Shortcut */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-5 w-5 text-slate-600" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Have new lab reports?</h5>
                    <p className="text-[11px] text-slate-500">Upload PDF/scans to update your health journey</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/patient/ai/reports', {
                    state: {
                      fromJourney: true,
                      reportType: 'Blood Test'
                    }
                  })}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Upload
                </button>
              </div>

            </div>

          </div>

        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TWO-COLUMN SECTION: DETERMINISTIC LAB TRENDS & UNIFIED TIMELINE
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: DETERMINISTIC LAB TRENDS (Segregated by Report / Test Category) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Lab Telemetry & Report Panels</h3>
                    <p className="text-[11px] text-slate-500">Segregated by test panel and collection date</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Pure Mathematical Deltas
                </span>
              </div>

              {labTrends && labTrends.length > 0 ? (
                <div className="space-y-5">
                  {/* Category / Panel Grouping */}
                  {Array.from(new Set(labTrends.map(t => t.testCategory || 'General Lab Panel'))).map(category => {
                    const categoryTrends = labTrends.filter(t => (t.testCategory || 'General Lab Panel') === category);
                    const abnormalCount = categoryTrends.filter(t => t.latestFlag === 'HIGH' || t.latestFlag === 'LOW' || t.latestFlag === 'CRITICAL_HIGH').length;
                    const latestDate = categoryTrends[0]?.latestDate || 'Recent';

                    return (
                      <div key={category} className="border border-slate-200/90 rounded-2xl overflow-hidden bg-slate-50/50 shadow-xs">
                        {/* Panel Header */}
                        <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🧪</span>
                            <div>
                              <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">{category}</h4>
                              <p className="text-[10px] text-slate-500 font-medium">Recorded: {latestDate}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {abnormalCount > 0 ? (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold rounded-full text-[10px] border border-rose-200">
                                {abnormalCount} Abnormal
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded-full text-[10px] border border-emerald-200">
                                ✓ All Normal
                              </span>
                            )}
                            <span className="px-2 py-0.5 bg-white text-slate-600 font-medium rounded-full text-[10px] border border-slate-200">
                              {categoryTrends.length} Tests
                            </span>
                          </div>
                        </div>

                        {/* Parameter Rows */}
                        <div className="divide-y divide-slate-100 bg-white">
                          {categoryTrends.map((trend, idx) => (
                            <div key={idx} className="p-3.5 hover:bg-slate-50/80 transition-colors">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-bold text-xs text-slate-900">{trend.parameterName}</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    Ref: {trend.referenceRangeText || 'Standard Range'}
                                  </p>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    trend.latestFlag === 'HIGH' || trend.latestFlag === 'CRITICAL_HIGH'
                                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                      : trend.latestFlag === 'LOW'
                                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    {trend.latestRawValue} {trend.unit || ''}
                                  </span>
                                </div>
                              </div>

                              {trend.previousValue !== undefined && (
                                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400">
                                    Baseline: {trend.previousRawValue} {trend.unit || ''} ({trend.previousDate})
                                  </span>
                                  <span className={`font-bold flex items-center gap-1 ${
                                    trend.trendDirection === 'INCREASED' ? 'text-blue-600' :
                                    trend.trendDirection === 'DECREASED' ? 'text-purple-600' : 'text-slate-600'
                                  }`}>
                                    {trend.trendDirection === 'INCREASED' ? <TrendingUp className="h-3 w-3" /> :
                                     trend.trendDirection === 'DECREASED' ? <TrendingDown className="h-3 w-3" /> :
                                     <Minus className="h-3 w-3 text-slate-400" />}
                                    {trend.deltaPercentage !== undefined ? `${Math.abs(trend.deltaPercentage)}% delta` : ''}
                                    <span className="text-[10px] text-slate-400 font-normal">({trend.statusTransition})</span>
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Activity className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">No lab test readings recorded yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Upload a report from your health journey to see deterministic telemetry.</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: UNIFIED CHRONOLOGICAL HEALTH TIMELINE */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <h3 className="font-extrabold text-slate-900 text-base">Unified Health Timeline</h3>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-1.5 mb-5 pb-3 border-b border-slate-100">
                {(['ALL', 'CONSULTATION', 'PRESCRIPTION', 'LAB_REPORT', 'CARE_TASK'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setTimelineFilter(f)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                      timelineFilter === f
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'ALL' ? 'All Events' : f.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {filteredTimeline.length > 0 ? (
                <div className="relative pl-6 border-l-2 border-blue-100 space-y-6">
                  {filteredTimeline.map((item) => (
                    <div key={item.id} className="relative group">
                      {/* Timeline Node Icon */}
                      <div className="absolute -left-[31px] top-0 w-8 h-8 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                        {item.eventType === 'CONSULTATION' && <Stethoscope className="h-3.5 w-3.5" />}
                        {item.eventType === 'PRESCRIPTION' && <Pill className="h-3.5 w-3.5" />}
                        {item.eventType === 'LAB_REPORT' && <FileText className="h-3.5 w-3.5" />}
                        {item.eventType === 'TREATMENT_PLAN' && <Activity className="h-3.5 w-3.5" />}
                        {item.eventType === 'CARE_TASK' && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </div>

                      <div className="bg-slate-50/80 hover:bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                            {item.status}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                        {item.subtitle && <p className="text-xs text-slate-600 font-medium mt-0.5">{item.subtitle}</p>}
                        {item.description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Clock className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">No timeline events found</p>
                </div>
              )}

            </div>
          </div>

        </div>

      </main>

      {/* ═══════════════════════════════════════════════════════════════════
          AI HEALTH CONTEXT LAYER (DRAWER / SLIDEOUT)
          ═══════════════════════════════════════════════════════════════════ */}
      {aiDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-slide-left">
            
            {/* Drawer Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <Bot className="h-6 w-6" />
                <div>
                  <h3 className="font-bold text-base">AI Health Journey Navigator</h3>
                  <p className="text-[11px] text-emerald-100">Grounded in your active Medivra records</p>
                </div>
              </div>
              <button 
                onClick={() => setAiDrawerOpen(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                ✕
              </button>
            </div>

            {/* AI Conversation Stream */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 leading-relaxed">
                👋 Hello! I have full context of your <strong>active treatment plan</strong>, <strong>prescribed medicines</strong>, and <strong>lab report trends</strong>.
                <p className="text-[11px] text-emerald-700 mt-1 italic">
                  Note: I explain and navigate what Medivra already knows. I do not diagnose or modify treatments.
                </p>
              </div>

              {/* Sample Prompts */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Suggested questions:</p>
                {[
                  "What medicines do I have to take today?",
                  "Explain my latest lab test results",
                  "What diagnostic tests are coming up next?",
                  "When is my follow-up review due?"
                ].map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAskAi(q)}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold border border-slate-200 transition-colors flex items-center justify-between"
                  >
                    <span>{q}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                ))}
              </div>

              {/* Dialogue History */}
              {aiHistory.map((item, idx) => (
                <div key={idx} className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="p-3 bg-blue-50 text-blue-900 rounded-2xl text-xs font-bold">
                    Q: {item.question}
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 leading-relaxed whitespace-pre-line shadow-sm">
                    {item.response.answer}
                  </div>
                </div>
              ))}

              {aiLoading && (
                <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-2xl text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  Reading health journey context and formulating explanation...
                </div>
              )}
            </div>

            {/* Input Footer */}
            <div className="p-4 border-t border-slate-200 bg-white shrink-0">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleAskAi(); }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Ask anything about your journey..."
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={aiLoading || !aiQuestion.trim()}
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-md transition-all"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
