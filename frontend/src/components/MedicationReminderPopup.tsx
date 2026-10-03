import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pill, Check, X, Clock, Sparkles, Bell, ChevronRight } from 'lucide-react';
import { journeyService, type MedicationDoseLog } from '../services/journey';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Determine the current dose time-slot based on the hour of day. */
const getCurrentSlot = (): 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT' => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'MORNING';
  if (h >= 12 && h < 17) return 'AFTERNOON';
  if (h >= 17 && h < 21) return 'EVENING';
  return 'NIGHT';
};

const SLOT_CONFIG: Record<string, { label: string; emoji: string; gradient: string; accent: string }> = {
  MORNING:   { label: 'Good Morning',   emoji: '🌅', gradient: 'from-amber-500 to-orange-500', accent: 'amber' },
  AFTERNOON: { label: 'Good Afternoon', emoji: '☀️', gradient: 'from-blue-500 to-cyan-500',    accent: 'blue' },
  EVENING:   { label: 'Good Evening',   emoji: '🌇', gradient: 'from-purple-500 to-pink-500',  accent: 'purple' },
  NIGHT:     { label: 'Good Night',     emoji: '🌙', gradient: 'from-indigo-600 to-slate-700',  accent: 'indigo' },
};

/** How often (ms) to poll for pending doses — 2 minutes */
const POLL_INTERVAL = 2 * 60 * 1000;

/** Cooldown after user dismisses/acts on reminders before showing again — 30 minutes */
const DISMISS_COOLDOWN = 30 * 60 * 1000;

// ── Component ────────────────────────────────────────────────────────────────

const MedicationReminderPopup: React.FC = () => {
  const [pendingDoses, setPendingDoses] = useState<MedicationDoseLog[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [loadingDoseId, setLoadingDoseId] = useState<string | null>(null);
  const [successDoseId, setSuccessDoseId] = useState<string | null>(null);
  const [totalPending, setTotalPending] = useState(0);

  const dismissedUntilRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const role = localStorage.getItem('role');
  const patientId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  const isPatient = role === 'PATIENT' && !!patientId && !!token;

  /** Fetch today's pending doses for the current time slot. */
  const checkForPendingDoses = useCallback(async () => {
    if (!isPatient) return;

    // Respect the dismiss cooldown
    if (Date.now() < dismissedUntilRef.current) return;

    try {
      const nextActions = await journeyService.getNextActions(patientId!);
      const currentSlot = getCurrentSlot();

      // Filter: only SCHEDULED doses for the current slot (not yet taken/skipped)
      const pending = (nextActions.todayDoses || []).filter(
        (d) => d.status === 'SCHEDULED' && d.doseSlot === currentSlot
      );

      if (pending.length > 0) {
        setPendingDoses(pending);
        setTotalPending(pending.length);
        setIsVisible(true);
        setIsAnimatingOut(false);
      }
    } catch (err) {
      // Silently ignore — this is a background check, should never disrupt UX
      console.debug('[MedicationReminder] Check failed:', err);
    }
  }, [isPatient, patientId]);

  // Set up the polling interval
  useEffect(() => {
    if (!isPatient) return;

    // Initial check after a short delay (don't block first paint)
    const initialTimeout = setTimeout(() => {
      checkForPendingDoses();
    }, 3000);

    // Recurring poll
    pollTimerRef.current = setInterval(checkForPendingDoses, POLL_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isPatient, checkForPendingDoses]);

  /** Handle Take / Skip with animation feedback. */
  const handleDoseAction = async (doseId: string, status: 'TAKEN' | 'SKIPPED') => {
    setLoadingDoseId(doseId);
    try {
      await journeyService.confirmDose(doseId, status);
      setSuccessDoseId(doseId);

      // Brief success flash, then remove from the list
      setTimeout(() => {
        setPendingDoses((prev) => {
          const updated = prev.filter((d) => d.id !== doseId);
          if (updated.length === 0) {
            // All doses handled — dismiss popup
            handleDismiss();
          }
          return updated;
        });
        setSuccessDoseId(null);
        setLoadingDoseId(null);
      }, 600);
    } catch (err) {
      console.error('[MedicationReminder] Failed to confirm dose:', err);
      setLoadingDoseId(null);
    }
  };

  /** Animate out and dismiss the popup. Set cooldown. */
  const handleDismiss = useCallback(() => {
    setIsAnimatingOut(true);
    dismissedUntilRef.current = Date.now() + DISMISS_COOLDOWN;
    setTimeout(() => {
      setIsVisible(false);
      setIsAnimatingOut(false);
      setPendingDoses([]);
    }, 350);
  }, []);

  /** Mark all remaining pending doses as taken at once. */
  const handleTakeAll = async () => {
    for (const dose of pendingDoses) {
      if (dose.status === 'SCHEDULED') {
        await handleDoseAction(dose.id, 'TAKEN');
      }
    }
  };

  // Don't render anything if not applicable
  if (!isPatient || !isVisible || pendingDoses.length === 0) return null;

  const currentSlot = getCurrentSlot();
  const slotInfo = SLOT_CONFIG[currentSlot];

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isAnimatingOut ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleDismiss}
      />

      {/* Popup Container */}
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none transition-all duration-350 ${
          isAnimatingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
      >
        <div
          className="pointer-events-auto w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          style={{
            animation: isAnimatingOut
              ? 'reminderSlideOut 0.35s ease-in forwards'
              : 'reminderSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}
        >
          {/* Header — Gradient Banner */}
          <div className={`bg-gradient-to-r ${slotInfo.gradient} p-6 pb-5 relative overflow-hidden`}>
            {/* Decorative circles */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
            <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-white/5 rounded-full" />

            <div className="relative z-10 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-2xl">{slotInfo.emoji}</span>
                  <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">
                    {slotInfo.label}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  Medication Reminder
                </h2>
                <p className="text-white/70 text-xs mt-1">
                  You have <strong className="text-white">{totalPending}</strong> pending{' '}
                  {totalPending === 1 ? 'dose' : 'doses'} for your {currentSlot.toLowerCase()} slot
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all cursor-pointer"
                aria-label="Dismiss reminder"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pulsing bell indicator */}
            <div className="absolute top-4 right-16 opacity-20">
              <Bell className="w-12 h-12 text-white animate-pulse" />
            </div>
          </div>

          {/* Dose List */}
          <div className="p-5 space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
            {pendingDoses.map((dose) => {
              const isLoading = loadingDoseId === dose.id;
              const isSuccess = successDoseId === dose.id;

              return (
                <div
                  key={dose.id}
                  className={`p-4 rounded-2xl border transition-all duration-300 ${
                    isSuccess
                      ? 'bg-emerald-50 border-emerald-300 scale-[0.97]'
                      : 'bg-slate-50/80 border-slate-200 hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Medicine Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-all duration-300 ${
                          isSuccess
                            ? 'bg-emerald-500 text-white'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {isSuccess ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <Pill className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">
                          {dose.medicineName}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {dose.dosage} • {dose.doseSlot}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSuccess ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-2 rounded-xl">
                          <Check className="h-3.5 w-3.5" /> Done
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleDoseAction(dose.id, 'TAKEN')}
                            disabled={isLoading}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-500/20 flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            {isLoading ? (
                              <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Taken
                          </button>
                          <button
                            onClick={() => handleDoseAction(dose.id, 'SKIPPED')}
                            disabled={isLoading}
                            className="px-2.5 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95"
                          >
                            Skip
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="px-5 pb-5 pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Remind Me Later
            </button>

            {pendingDoses.length > 1 && (
              <button
                onClick={handleTakeAll}
                disabled={!!loadingDoseId}
                className={`px-5 py-2.5 bg-gradient-to-r ${slotInfo.gradient} hover:opacity-90 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Take All ({pendingDoses.length})
              </button>
            )}
          </div>

          {/* Subtle link to full Health Journey */}
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-100">
            <a
              href="/patient/dashboard"
              className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-blue-600 transition-colors"
            >
              View full Health Journey
              <ChevronRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default MedicationReminderPopup;
