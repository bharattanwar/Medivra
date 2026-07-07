import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi, WifiOff,
  Activity, Navigation, Car
} from 'lucide-react';
import {
  registerAmbulance, goOnline, goOffline, pushLocation,
  acceptEmergency, rejectEmergency, updateTripStatus, getActiveEmergency,
  type EmergencyResponse, type EmergencyStatus
} from '../services/emergency';
import { useWebSocket } from '../context/WebSocketContext';

const TRIP_STEPS: { status: EmergencyStatus; label: string; action: string }[] = [
  { status: 'EN_ROUTE',            label: 'En Route to Patient',   action: 'Start Driving' },
  { status: 'ARRIVED_AT_PATIENT',  label: 'Arrived at Patient',    action: 'Mark Arrived' },
  { status: 'TRANSPORTING',        label: 'Transporting Patient',  action: 'Patient On Board' },
  { status: 'ARRIVED_AT_HOSPITAL', label: 'Arrived at Hospital',   action: 'At Hospital' },
  { status: 'COMPLETED',           label: 'Emergency Completed',   action: 'Complete Trip' },
];

const AmbulanceDashboard: React.FC = () => {
  const [isOnline, setIsOnline]           = useState(false);
  const [ambulanceId, setAmbulanceId]     = useState('');
  const [showRegister, setShowRegister]   = useState(false);
  const [regForm, setRegForm]             = useState({ vehicleNumber: '', ambulanceType: 'BASIC', equipmentNotes: '' });
  const [activeEmergency, setActiveEmergency] = useState<EmergencyResponse | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<EmergencyResponse | null>(null);
  const [countdown, setCountdown]         = useState(30);
  const [locationTracking, setLocationTracking] = useState(false);
  const [currentTripStatus, setCurrentTripStatus] = useState<EmergencyStatus | null>(null);
  const [loading, setLoading]             = useState(false);

  const watchRef  = useRef<number | null>(null);
  const cdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const { client, isConnected } = useWebSocket();

  // Subscribe to incoming dispatch requests via WebSocket
  useEffect(() => {
    if (!client || !isConnected || !isOnline) return;
    const sub = client.subscribe('/user/queue/ambulance-dispatch', (msg) => {
      if (msg.body) {
        const req = JSON.parse(msg.body);
        setIncomingRequest(req);
        startCountdown();
      }
    });
    return () => sub.unsubscribe();
  }, [client, isConnected, isOnline]);

  // Load active emergency on mount
  useEffect(() => {
    const storedId = localStorage.getItem('ambulanceId');
    if (storedId) setAmbulanceId(storedId);
    getActiveEmergency().then(e => {
      if (e) { setActiveEmergency(e); setCurrentTripStatus(e.status); }
    }).catch(() => {});
  }, []);

  const startCountdown = () => {
    setCountdown(30);
    if (cdownRef.current) clearInterval(cdownRef.current);
    cdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(cdownRef.current!);
          setIncomingRequest(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRegister = async () => {
    if (!regForm.vehicleNumber) return;
    try {
      setLoading(true);
      const result = await registerAmbulance(regForm);
      const id = result.id;
      setAmbulanceId(id);
      localStorage.setItem('ambulanceId', id);
      setShowRegister(false);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const handleGoOnline = async () => {
    if (!ambulanceId) { setShowRegister(true); return; }
    try {
      await goOnline(ambulanceId);
      setIsOnline(true);
      startLocationTracking();
    } catch {}
  };

  const handleGoOffline = async () => {
    try {
      await goOffline(ambulanceId);
      setIsOnline(false);
      stopLocationTracking();
    } catch {}
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) return;
    setLocationTracking(true);
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (ambulanceId) pushLocation(ambulanceId, loc.lat, loc.lng).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  };

  const stopLocationTracking = () => {
    setLocationTracking(false);
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
  };

  const handleAccept = async () => {
    if (!incomingRequest || !ambulanceId) return;
    try {
      setLoading(true);
      const emergency = await acceptEmergency(incomingRequest.id as any, ambulanceId);
      setActiveEmergency(emergency);
      setCurrentTripStatus(emergency.status);
      setIncomingRequest(null);
      if (cdownRef.current) clearInterval(cdownRef.current);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Could not accept — another driver was faster!');
      setIncomingRequest(null);
    } finally { setLoading(false); }
  };

  const handleReject = async () => {
    if (!incomingRequest) return;
    try { await rejectEmergency(incomingRequest.id as any); } catch {}
    setIncomingRequest(null);
    if (cdownRef.current) clearInterval(cdownRef.current);
  };

  const handleTripStep = async (nextStatus: EmergencyStatus) => {
    if (!activeEmergency) return;
    try {
      setLoading(true);
      const updated = await updateTripStatus(activeEmergency.id, nextStatus);
      setActiveEmergency(updated);
      setCurrentTripStatus(nextStatus);
      if (nextStatus === 'COMPLETED') {
        setActiveEmergency(null);
        setCurrentTripStatus(null);
      }
    } catch (err: any) {
      alert('Failed to update status');
    } finally { setLoading(false); }
  };

  const currentStepIdx = TRIP_STEPS.findIndex(s => s.status === currentTripStatus);
  const nextStep = currentStepIdx < TRIP_STEPS.length - 1 ? TRIP_STEPS[currentStepIdx + 1] : null;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 100%)', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .amb-card { background: rgba(255,255,255,0.06); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 24px; }
        .amb-btn { border: none; border-radius: 12px; padding: 13px 24px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .amb-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.07); color: #fff; font-size: 14px; margin-bottom: 10px; }
        .amb-input::placeholder { color: rgba(255,255,255,0.35); }
        .amb-input:focus { outline: none; border-color: #22c55e; }
        .step-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .step-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
        @keyframes ring { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        .incoming-ring { animation: ring 0.8s ease-in-out infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; margin-right: 8px; vertical-align: middle; }
      `}</style>

      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #22c55e, #16a34a)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Car size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Ambulance Partner</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Medivra Driver App</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {locationTracking && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#22c55e', background: 'rgba(34,197,94,0.15)', padding: '4px 10px', borderRadius: 20 }}>
              <Navigation size={12} /> GPS Active
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: isOnline ? '#22c55e' : '#94a3b8' }}>
            {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 20px' }}>

        {/* Registration Modal */}
        {showRegister && (
          <div className="amb-card" style={{ marginBottom: 24, border: '1px solid rgba(34,197,94,0.3)' }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Register Your Ambulance</div>
            <input className="amb-input" placeholder="Vehicle Number (e.g. MH-12-AB-1234)" value={regForm.vehicleNumber}
              onChange={e => setRegForm({ ...regForm, vehicleNumber: e.target.value })} />
            <select className="amb-input" value={regForm.ambulanceType}
              onChange={e => setRegForm({ ...regForm, ambulanceType: e.target.value })}
              style={{ cursor: 'pointer' }}>
              {['BASIC', 'ICU', 'CARDIAC', 'NEONATAL'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="amb-input" placeholder="Equipment notes (optional)" value={regForm.equipmentNotes}
              onChange={e => setRegForm({ ...regForm, equipmentNotes: e.target.value })} />
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="amb-btn" style={{ background: '#22c55e', color: '#fff' }} onClick={handleRegister} disabled={loading}>
                {loading && <span className="spinner" />} Register
              </button>
              <button className="amb-btn" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }} onClick={() => setShowRegister(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Online / Offline Toggle */}
        <div className="amb-card" style={{ marginBottom: 24, textAlign: 'center' }}>
          {isOnline ? (
            <>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>You are <strong style={{ color: '#22c55e' }}>online</strong> and receiving requests</div>
              <button className="amb-btn" style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff', width: '100%', fontSize: 17 }} onClick={handleGoOffline}>
                Go Offline
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>You are <strong style={{ color: '#94a3b8' }}>offline</strong>. Go online to receive emergency requests.</div>
              <button className="amb-btn" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', width: '100%', fontSize: 17 }} onClick={handleGoOnline}>
                Go Online
              </button>
              {!ambulanceId && (
                <div style={{ marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  No ambulance registered. <span style={{ color: '#22c55e', cursor: 'pointer' }} onClick={() => setShowRegister(true)}>Register now →</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Incoming Emergency Request */}
        {incomingRequest && (
          <div className="amb-card incoming-ring" style={{ marginBottom: 24, border: '2px solid #ef4444', background: 'rgba(220,38,38,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 20, color: '#f87171' }}>🚨 Emergency Request</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: countdown < 10 ? '#ef4444' : '#fbbf24' }}>{countdown}s</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Emergency Type</div>
                <div style={{ fontWeight: 700 }}>{(incomingRequest as any).emergencyType || 'GENERAL'}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Distance</div>
                <div style={{ fontWeight: 700 }}>{(incomingRequest as any).distanceKm ?? '—'} km</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Est. Travel Time</div>
                <div style={{ fontWeight: 700 }}>{(incomingRequest as any).estimatedMinutes ?? '—'} min</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Ambulance Type</div>
                <div style={{ fontWeight: 700 }}>{(incomingRequest as any).ambulanceType || regForm.ambulanceType}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="amb-btn" style={{ flex: 1, background: '#22c55e', color: '#fff', fontSize: 16 }} onClick={handleAccept} disabled={loading}>
                {loading && <span className="spinner" />} ✓ Accept
              </button>
              <button className="amb-btn" style={{ flex: 1, background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }} onClick={handleReject}>
                ✕ Decline
              </button>
            </div>
          </div>
        )}

        {/* Active Trip */}
        {activeEmergency && !incomingRequest && (
          <>
            <div className="amb-card" style={{ marginBottom: 24, border: '1px solid rgba(34,197,94,0.3)' }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: '#22c55e' }}>Active Emergency</div>

              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Patient Location</div>
                <div style={{ fontWeight: 600 }}>📍 {activeEmergency.patientLat?.toFixed(5)}, {activeEmergency.patientLng?.toFixed(5)}</div>
                {activeEmergency.patientAddress && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{activeEmergency.patientAddress}</div>}
              </div>

              {/* Navigate Button */}
              <a
                href={`https://maps.google.com/?q=${activeEmergency.patientLat},${activeEmergency.patientLng}&navigate=yes`}
                target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', padding: '13px', borderRadius: 12, textDecoration: 'none', fontWeight: 700, marginBottom: 16 }}>
                <Navigation size={18} /> Navigate to Patient
              </a>

              {/* Trip Status Steps */}
              <div className="amb-card" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Trip Progress</div>
                {TRIP_STEPS.map((step, i) => {
                  const done = i < currentStepIdx;
                  const current = i === currentStepIdx;
                  return (
                    <div key={step.status} className="step-row">
                      <div className="step-dot" style={{ background: done ? '#22c55e' : current ? '#ef4444' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
                        {done ? '✓' : i + 1}
                      </div>
                      <div style={{ flex: 1, fontWeight: current ? 700 : 400, color: done ? '#22c55e' : current ? '#fff' : 'rgba(255,255,255,0.35)', fontSize: 14 }}>
                        {step.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Next Action */}
              {nextStep && (
                <button className="amb-btn" style={{ width: '100%', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontSize: 16 }}
                  onClick={() => handleTripStep(nextStep.status)} disabled={loading}>
                  {loading && <span className="spinner" />} {nextStep.action}
                </button>
              )}
            </div>

            {/* Map */}
            <div className="amb-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>Patient Location</div>
              <iframe title="Patient Map" width="100%" height="260" frameBorder="0" style={{ display: 'block' }}
                src={`https://maps.google.com/maps?q=${activeEmergency.patientLat},${activeEmergency.patientLng}&z=15&output=embed`} />
            </div>
          </>
        )}

        {/* Idle state */}
        {isOnline && !activeEmergency && !incomingRequest && (
          <div className="amb-card" style={{ textAlign: 'center', padding: 60 }}>
            <Activity size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>Waiting for emergency requests…</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>You'll be notified instantly when a patient nearby needs help</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AmbulanceDashboard;
