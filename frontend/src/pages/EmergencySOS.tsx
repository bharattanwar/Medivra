import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertTriangle, Heart, Car, Activity, Baby, Wind, Zap,
  Phone, CheckCircle, User, Shield, Plus, Trash2,
  Navigation, AlertCircle
} from 'lucide-react';
import {
  triggerSos, cancelEmergency, getEmergencyStatus, getEmergencyHistory,
  getEmergencyContacts, addEmergencyContact, deleteEmergencyContact,
  type EmergencyResponse, type EmergencyContact, type EmergencyType, type EmergencyStatus
} from '../services/emergency';
import { useWebSocket } from '../context/WebSocketContext';

// ── Constants ────────────────────────────────────────────────────────────────

const EMERGENCY_TYPES: { key: EmergencyType; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { key: 'CARDIAC',     label: 'Cardiac',     icon: <Heart size={20}/>,      color: '#ef4444', bg: '#fee2e2' },
  { key: 'ACCIDENT',    label: 'Accident',    icon: <Car size={20}/>,        color: '#f97316', bg: '#ffedd5' },
  { key: 'STROKE',      label: 'Stroke',      icon: <Activity size={20}/>,   color: '#a855f7', bg: '#f3e8ff' },
  { key: 'PREGNANCY',   label: 'Pregnancy',   icon: <Baby size={20}/>,       color: '#ec4899', bg: '#fce7f3' },
  { key: 'TRAUMA',      label: 'Trauma',      icon: <AlertTriangle size={20}/>, color: '#ef4444', bg: '#fee2e2' },
  { key: 'RESPIRATORY', label: 'Respiratory', icon: <Wind size={20}/>,       color: '#06b6d4', bg: '#cffafe' },
  { key: 'PEDIATRIC',   label: 'Pediatric',   icon: <Baby size={20}/>,       color: '#8b5cf6', bg: '#ede9fe' },
  { key: 'GENERAL',     label: 'General',     icon: <Zap size={20}/>,        color: '#64748b', bg: '#f1f5f9' },
];

const STATUS_STEPS: { status: EmergencyStatus; label: string }[] = [
  { status: 'SEARCHING',          label: 'Finding ambulance' },
  { status: 'AMBULANCE_ASSIGNED', label: 'Ambulance dispatched' },
  { status: 'EN_ROUTE',           label: 'En route to you' },
  { status: 'ARRIVED_AT_PATIENT', label: 'Ambulance arrived' },
  { status: 'TRANSPORTING',       label: 'Transporting to hospital' },
  { status: 'ARRIVED_AT_HOSPITAL',label: 'At hospital' },
];

const statusOrder = STATUS_STEPS.map(s => s.status);

// ── Main Component ────────────────────────────────────────────────────────────

const EmergencySOS: React.FC = () => {
  const [view, setView]                   = useState<'main' | 'active' | 'history' | 'contacts'>('main');
  const [selectedType, setSelectedType]   = useState<EmergencyType>('GENERAL');
  const [holding, setHolding]             = useState(false);
  const [holdProgress, setHoldProgress]   = useState(0);
  const [gpsLoading, setGpsLoading]       = useState(false);
  const [gpsError, setGpsError]           = useState('');
  const [loading, setLoading]             = useState(false);
  const [activeEmergency, setActiveEmergency] = useState<EmergencyResponse | null>(null);
  const [history, setHistory]             = useState<EmergencyResponse[]>([]);
  const [contacts, setContacts]           = useState<EmergencyContact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact]       = useState({ name: '', phone: '', email: '', relationship: '' });
  const [ambulanceLoc, setAmbulanceLoc]   = useState<{ lat: number; lng: number } | null>(null);
  const [coords, setCoords]               = useState<{ lat: number; lng: number } | null>(null);
  const [dialCountdown, setDialCountdown] = useState<number | null>(null);
  const [dialSimulated, setDialSimulated] = useState(false);

  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const { client, isConnected } = useWebSocket();

  // Load contacts & history on mount
  useEffect(() => {
    loadContacts();
    loadHistory();
  }, []);

  // Subscribe to real-time SOS updates
  useEffect(() => {
    if (!client || !isConnected || !activeEmergency) return;
    const sub = client.subscribe('/user/queue/sos', (msg) => {
      if (msg.body) {
        const updated: EmergencyResponse = JSON.parse(msg.body);
        setActiveEmergency(updated);
      }
    });

    let locSub: any;
    locSub = client.subscribe(`/topic/emergency/${activeEmergency.id}`, (msg) => {
      if (msg.body) {
        const loc = JSON.parse(msg.body);
        setAmbulanceLoc({ lat: loc.lat, lng: loc.lng });
      }
    });

    return () => { sub.unsubscribe(); locSub?.unsubscribe(); };
  }, [client, isConnected, activeEmergency?.id]);

  // Monitor status to trigger simulated 112 countdown
  useEffect(() => {
    if (activeEmergency?.status === 'ESCALATED') {
      if (!dialSimulated && dialCountdown === null) {
        setDialCountdown(15);
        countdownInterval.current = setInterval(() => {
          setDialCountdown(prev => {
            if (prev !== null && prev <= 1) {
              clearInterval(countdownInterval.current!);
              setDialSimulated(true);
              return null;
            }
            return prev !== null ? prev - 1 : null;
          });
        }, 1000);
      }
    } else {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      setDialCountdown(null);
      setDialSimulated(false);
    }

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, [activeEmergency?.status]);

  const loadContacts = async () => {
    try { setContacts(await getEmergencyContacts()); } catch {}
  };

  const loadHistory = async () => {
    try { setHistory(await getEmergencyHistory()); } catch {}
  };

  // GPS acquisition
  const acquireGPS = (): Promise<{ lat: number; lng: number }> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject('Geolocation not supported'); return; }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        e => reject(e.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  // Hold-to-trigger SOS (3 seconds)
  const startHold = useCallback(() => {
    setHolding(true);
    setHoldProgress(0);
    const start = Date.now();
    const HOLD_MS = 3000;
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / HOLD_MS) * 100, 100);
      setHoldProgress(pct);
      if (pct >= 100) {
        clearInterval(holdTimer.current!);
        holdTimer.current = null;
        handleSosSubmit();
      }
    }, 50);
  }, [selectedType]);

  const cancelHold = useCallback(() => {
    setHolding(false);
    setHoldProgress(0);
    if (holdTimer.current) { clearInterval(holdTimer.current); holdTimer.current = null; }
  }, []);

  const handleSosSubmit = async () => {
    setHolding(false);
    setGpsLoading(true);
    setGpsError('');
    try {
      const position = await acquireGPS();
      setCoords(position);
      setGpsLoading(false);
      setLoading(true);
      const emergency = await triggerSos({
        lat: position.lat, lng: position.lng,
        emergencyType: selectedType,
      });
      setActiveEmergency(emergency);
      setView('active');
    } catch (err: any) {
      setGpsError(err?.message || 'Failed to get location. Please enable GPS.');
      setGpsLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!activeEmergency) return;
    if (!window.confirm('Cancel this emergency?')) return;
    try {
      const cancelled = await cancelEmergency(activeEmergency.id);
      setActiveEmergency(cancelled);
      setView('main');
      loadHistory();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to cancel');
    }
  };

  const handleAddContact = async () => {
    if (!newContact.name || !newContact.phone) return;
    try {
      await addEmergencyContact(newContact);
      setNewContact({ name: '', phone: '', email: '', relationship: '' });
      setShowAddContact(false);
      loadContacts();
    } catch {}
  };

  const handleDeleteContact = async (id: string) => {
    try { await deleteEmergencyContact(id); loadContacts(); } catch {}
  };

  const refreshStatus = async () => {
    if (!activeEmergency) return;
    try { setActiveEmergency(await getEmergencyStatus(activeEmergency.id)); } catch {}
  };

  const getStatusIndex = (status: EmergencyStatus) => statusOrder.indexOf(status);
  const currentStepIdx = activeEmergency ? getStatusIndex(activeEmergency.status) : -1;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="sos-root" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .sos-root * { box-sizing: border-box; }
        .sos-nav-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 8px 18px; border-radius: 24px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; }
        .sos-nav-btn:hover, .sos-nav-btn.active { background: rgba(239,68,68,0.3); border-color: #ef4444; }
        .hold-btn { position: relative; width: 200px; height: 200px; border-radius: 50%; border: none; cursor: pointer; outline: none; background: transparent; overflow: hidden; }
        .hold-btn-inner { width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, #dc2626, #991b1b); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; transition: transform 0.1s; box-shadow: 0 0 60px rgba(220,38,38,0.5); }
        .hold-btn:active .hold-btn-inner, .hold-btn.holding .hold-btn-inner { transform: scale(0.95); }
        .hold-ring { position: absolute; inset: 0; border-radius: 50%; }
        .pulse-ring { position: absolute; inset: -10px; border-radius: 50%; border: 3px solid rgba(239,68,68,0.4); animation: sosPulse 2s infinite; }
        @keyframes sosPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.15);opacity:0.4} }
        .type-chip { border: 2px solid transparent; border-radius: 12px; padding: 10px 14px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; }
        .type-chip:hover { transform: translateY(-2px); }
        .step { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; }
        .step-dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; font-weight: 700; }
        .glass-card { background: rgba(255,255,255,0.07); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 24px; }
        .contact-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .input-field { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #fff; font-size: 14px; }
        .input-field::placeholder { color: rgba(255,255,255,0.4); }
        .input-field:focus { outline: none; border-color: #ef4444; }
        .red-btn { background: linear-gradient(135deg, #dc2626, #b91c1c); color: #fff; border: none; border-radius: 12px; padding: 12px 24px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .red-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(220,38,38,0.4); }
        .ghost-btn { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 12px 24px; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .ghost-btn:hover { background: rgba(255,255,255,0.15); }
        .driver-card { background: linear-gradient(135deg, rgba(220,38,38,0.2), rgba(153,27,27,0.2)); border: 1px solid rgba(220,38,38,0.3); border-radius: 16px; padding: 20px; }
        .map-embed { border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.12); }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .status-searching { background: rgba(234,179,8,0.2); color: #fbbf24; border: 1px solid rgba(234,179,8,0.3); }
        .status-assigned  { background: rgba(59,130,246,0.2); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); }
        .status-enroute   { background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
        .status-completed { background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
        .status-cancelled { background: rgba(107,114,128,0.2); color: #9ca3af; border: 1px solid rgba(107,114,128,0.3); }
        .status-escalated { background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
      `}</style>

      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '16px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #dc2626, #991b1b)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px' }}>Emergency SOS</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Medivra · Immediate Response</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['main', 'history', 'contacts'] as const).map(v => (
              <button key={v} className={`sos-nav-btn ${view === v ? 'active' : ''}`}
                onClick={() => setView(v === view ? 'main' : v)}>
                {v === 'main' ? 'SOS' : v === 'history' ? 'History' : 'Contacts'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>

        {/* ── MAIN SOS VIEW ───────────────────────────────────────────────── */}
        {view === 'main' && (
          <>
            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h1 style={{ fontSize: 36, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-1px' }}>
                One tap. Immediate help.
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, margin: 0 }}>
                Hold the button for 3 seconds to summon the nearest ambulance
              </p>
            </div>

            {/* Emergency Type Selector */}
            <div className="glass-card" style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>
                Select Emergency Type
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {EMERGENCY_TYPES.map(t => (
                  <button
                    key={t.key}
                    className="type-chip"
                    onClick={() => setSelectedType(t.key)}
                    style={{
                      background: selectedType === t.key ? t.bg + '33' : 'rgba(255,255,255,0.05)',
                      borderColor: selectedType === t.key ? t.color : 'transparent',
                      color: selectedType === t.key ? t.color : 'rgba(255,255,255,0.7)',
                    }}>
                    <span style={{ color: t.color }}>{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SOS Button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                {/* Pulse rings */}
                <div className="pulse-ring" style={{ '--i': 0 } as any} />
                <div className="pulse-ring" style={{ animationDelay: '0.6s', '--i': 1 } as any} />

                {/* SVG progress ring */}
                <svg style={{ position: 'absolute', inset: -14, width: 228, height: 228, transform: 'rotate(-90deg)' }}>
                  <circle cx={114} cy={114} r={100} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={8} />
                  <circle cx={114} cy={114} r={100} fill="none" stroke="#ef4444" strokeWidth={8}
                    strokeDasharray={`${2 * Math.PI * 100}`}
                    strokeDashoffset={`${2 * Math.PI * 100 * (1 - holdProgress / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.05s linear' }} />
                </svg>

                <button
                  className={`hold-btn ${holding ? 'holding' : ''}`}
                  onMouseDown={startHold} onMouseUp={cancelHold} onMouseLeave={cancelHold}
                  onTouchStart={startHold} onTouchEnd={cancelHold}
                  disabled={gpsLoading || loading}>
                  <div className="hold-btn-inner">
                    {gpsLoading || loading ? (
                      <><div className="spinner" /><span style={{ fontSize: 14, fontWeight: 600 }}>Getting GPS…</span></>
                    ) : (
                      <>
                        <AlertTriangle size={40} color="#fff" style={{ filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5))' }} />
                        <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '2px' }}>SOS</span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Hold 3 seconds</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* GPS Error */}
            {gpsError && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, textAlign: 'center', color: '#f87171', fontSize: 14 }}>
                <AlertCircle size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                {gpsError}
              </div>
            )}

            {/* Info card */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {[
                { icon: <Navigation size={20}/>, title: 'GPS Located', desc: 'Your exact location is shared instantly' },
                { icon: <Phone size={20}/>, title: 'Contacts Notified', desc: 'Your emergency contacts get alerts' },
                { icon: <Shield size={20}/>, title: 'Hospital Ready', desc: 'Hospital is alerted before you arrive' },
              ].map((item, i) => (
                <div key={i} className="glass-card" style={{ textAlign: 'center', padding: '20px 16px' }}>
                  <div style={{ color: '#ef4444', marginBottom: 8 }}>{item.icon}</div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ACTIVE EMERGENCY VIEW ────────────────────────────────────────── */}
        {view === 'active' && activeEmergency && (
          <>
            {/* Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800 }}>Emergency Active</h2>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>ID: {activeEmergency.id.slice(0, 8).toUpperCase()}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="ghost-btn" style={{ padding: '8px 16px', fontSize: 13 }} onClick={refreshStatus}>Refresh</button>
                {activeEmergency.status !== 'COMPLETED' && activeEmergency.status !== 'CANCELLED' && (
                  <button className="ghost-btn" style={{ padding: '8px 16px', fontSize: 13, borderColor: '#ef4444', color: '#f87171' }} onClick={handleCancel}>Cancel</button>
                )}
              </div>
            </div>

            {/* ETA Card */}
            {activeEmergency.estimatedArrivalMinutes && (
              <div style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.3), rgba(153,27,27,0.2))', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 20, padding: 24, marginBottom: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Estimated Arrival</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: '#f87171', lineHeight: 1 }}>{activeEmergency.estimatedArrivalMinutes}</div>
                <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }}>minutes away</div>
              </div>
            )}

            {/* Progress Steps */}
            <div className="glass-card" style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 20 }}>Status</div>
              {STATUS_STEPS.map((step, i) => {
                const done = i < currentStepIdx;
                const current = i === currentStepIdx;
                return (
                  <div key={step.status} className="step">
                    <div className="step-dot" style={{
                      background: done ? '#22c55e' : current ? '#ef4444' : 'rgba(255,255,255,0.1)',
                      color: done || current ? '#fff' : 'rgba(255,255,255,0.3)',
                    }}>
                      {done ? <CheckCircle size={16} /> : i + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: current ? 700 : 500, color: done ? '#22c55e' : current ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 15 }}>
                        {step.label}
                      </div>
                      {current && <div style={{ fontSize: 12, color: '#f87171', marginTop: 2 }}>● In progress</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Driver Card */}
            {activeEmergency.driverName && (
              <div className="driver-card" style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>Your Ambulance</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <User size={16} color="#f87171" />
                      <span style={{ fontWeight: 700, fontSize: 18 }}>{activeEmergency.driverName}</span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>🚑 {activeEmergency.vehicleNumber} · {activeEmergency.ambulanceType}</div>
                  </div>
                  <a href={`tel:${activeEmergency.driverPhone}`}
                    style={{ background: '#22c55e', color: '#fff', padding: '12px 20px', borderRadius: 12, textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Phone size={16} /> Call Driver
                  </a>
                </div>
              </div>
            )}

            {/* Escalation Alert with Simulated 112 Dial Warning */}
            {activeEmergency.status === 'ESCALATED' && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 16, padding: 20, marginBottom: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171', marginBottom: 12 }}>⚠️ No ambulance available</div>
                
                {dialSimulated ? (
                  <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ color: '#22c55e', fontWeight: 'bold', fontSize: 15, marginBottom: 4 }}>
                      🚨 Simulated Call connected to 112 dispatcher.
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                      Patient GPS coordinates and emergency details have been relayed.
                    </div>
                  </div>
                ) : dialCountdown !== null ? (
                  <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: 15, marginBottom: 6 }}>
                      Simulating 112 dispatch call in {dialCountdown} seconds...
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 12 }}>
                      Click below to cancel if this is a test.
                    </div>
                    <button 
                      className="ghost-btn" 
                      style={{ background: 'rgba(239,68,68,0.2)', borderColor: '#ef4444', color: '#f87171', fontWeight: 'bold', padding: '8px 16px', fontSize: 13, width: '100%' }}
                      onClick={handleCancel}
                    >
                      Cancel Simulated Call
                    </button>
                  </div>
                ) : null}

                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 16 }}>
                  You can call the national emergency services line directly right now:
                </div>
                <a href="tel:112" style={{ display: 'block', background: '#dc2626', color: '#fff', padding: '14px 32px', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 18, transition: 'background 0.2s' }}
                   onMouseOver={e => e.currentTarget.style.background = '#b91c1c'}
                   onMouseOut={e => e.currentTarget.style.background = '#dc2626'}>
                  📞 Click to Call 112
                </a>
              </div>
            )}

            {/* Map */}
            {activeEmergency.patientLat && (
              <div className="glass-card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontWeight: 600 }}>Live Map</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    Your location: {coords?.lat || activeEmergency.patientLat.toFixed(5)}, {coords?.lng || activeEmergency.patientLng.toFixed(5)}
                    {ambulanceLoc && ` | Ambulance: ${ambulanceLoc.lat.toFixed(5)}, ${ambulanceLoc.lng.toFixed(5)}`}
                  </div>
                </div>
                <iframe
                  title="Emergency Map"
                  width="100%" height="300" frameBorder="0" style={{ display: 'block' }}
                  src={`https://maps.google.com/maps?q=${ambulanceLoc ? `${ambulanceLoc.lat},${ambulanceLoc.lng}` : `${activeEmergency.patientLat},${activeEmergency.patientLng}`}&z=15&output=embed`}
                />
                <div style={{ padding: '12px 20px' }}>
                  <a
                    href={`https://maps.google.com/?q=${activeEmergency.patientLat},${activeEmergency.patientLng}`}
                    target="_blank" rel="noreferrer"
                    style={{ color: '#60a5fa', fontSize: 13, textDecoration: 'none' }}>
                    Open in Google Maps →
                  </a>
                </div>
              </div>
            )}

            {/* Timeline */}
            {activeEmergency.timeline?.length > 0 && (
              <div className="glass-card">
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>Timeline</div>
                {activeEmergency.timeline.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < activeEmergency.timeline.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', marginTop: 6, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{t.event.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{t.description}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{new Date(t.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── HISTORY VIEW ─────────────────────────────────────────────────── */}
        {view === 'history' && (
          <>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>Emergency History</h2>
            {history.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: 60 }}>
                <AlertTriangle size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
                <div style={{ color: 'rgba(255,255,255,0.5)' }}>No emergency history</div>
              </div>
            ) : history.map(h => (
              <div key={h.id} className="glass-card" style={{ marginBottom: 16, cursor: 'pointer' }}
                onClick={() => { setActiveEmergency(h); setView('active'); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{h.emergencyType.replace(/_/g, ' ')} Emergency</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{new Date(h.createdAt).toLocaleString()}</div>
                    {h.patientAddress && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{h.patientAddress}</div>}
                  </div>
                  <span className={`badge status-${h.status.toLowerCase().replace(/_/g, '')}`}>{h.status.replace(/_/g, ' ')}</span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── CONTACTS VIEW ─────────────────────────────────────────────────── */}
        {view === 'contacts' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Emergency Contacts</h2>
              <button className="red-btn" style={{ padding: '10px 18px', fontSize: 14 }} onClick={() => setShowAddContact(true)}>
                <Plus size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Add Contact
              </button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 }}>
              These contacts will be automatically notified when you trigger an SOS.
            </p>

            {showAddContact && (
              <div className="glass-card" style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 700, marginBottom: 16 }}>New Emergency Contact</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <input className="input-field" placeholder="Full Name *" value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} />
                  <input className="input-field" placeholder="Phone Number *" value={newContact.phone} onChange={e => setNewContact({ ...newContact, phone: e.target.value })} />
                  <input className="input-field" placeholder="Email (optional)" value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })} />
                  <input className="input-field" placeholder="Relationship (e.g. Spouse)" value={newContact.relationship} onChange={e => setNewContact({ ...newContact, relationship: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="red-btn" onClick={handleAddContact}>Save Contact</button>
                  <button className="ghost-btn" onClick={() => setShowAddContact(false)}>Cancel</button>
                </div>
              </div>
            )}

            <div className="glass-card">
              {contacts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>
                  <User size={40} style={{ marginBottom: 12 }} />
                  <div>No emergency contacts added yet</div>
                </div>
              ) : contacts.map(c => (
                <div key={c.id} className="contact-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={18} color="#f87171" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{c.phone} {c.relationship ? `· ${c.relationship}` : ''}</div>
                      {c.email && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{c.email}</div>}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteContact(c.id)}
                    style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer', padding: 8 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmergencySOS;
