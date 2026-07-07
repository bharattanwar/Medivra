import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, AlertTriangle,
  CheckCircle, MapPin, RefreshCw, TrendingUp, Users, Zap, Navigation, Phone
} from 'lucide-react';
import {
  getHospitalActiveEmergencies, getFleetStatus, getEmergencyAnalytics,
  type EmergencyResponse,
} from '../services/emergency';
import { useWebSocket } from '../context/WebSocketContext';

const STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  AMBULANCE_ASSIGNED: { bg: 'rgba(59,130,246,0.2)',  text: '#60a5fa', label: 'Dispatched' },
  EN_ROUTE:           { bg: 'rgba(234,179,8,0.2)',   text: '#fbbf24', label: 'En Route' },
  ARRIVED_AT_PATIENT: { bg: 'rgba(168,85,247,0.2)',  text: '#c084fc', label: 'At Patient' },
  TRANSPORTING:       { bg: 'rgba(16,185,129,0.2)',  text: '#34d399', label: 'Transporting' },
  ARRIVED_AT_HOSPITAL:{ bg: 'rgba(34,197,94,0.2)',   text: '#22c55e', label: 'At Hospital' },
  COMPLETED:          { bg: 'rgba(34,197,94,0.15)',  text: '#86efac', label: 'Completed' },
  CANCELLED:          { bg: 'rgba(107,114,128,0.2)', text: '#9ca3af', label: 'Cancelled' },
  ESCALATED:          { bg: 'rgba(239,68,68,0.2)',   text: '#f87171', label: 'Escalated' },
  SEARCHING:          { bg: 'rgba(234,179,8,0.2)',   text: '#fbbf24', label: 'Searching' },
};

const EMERGENCY_ICONS: Record<string, string> = {
  CARDIAC: '❤️', ACCIDENT: '🚗', STROKE: '🧠', PREGNANCY: '🤱',
  TRAUMA: '🩹', RESPIRATORY: '💨', PEDIATRIC: '👶', GENERAL: '🚑',
};

const HospitalEmergencyDashboard: React.FC = () => {
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyResponse[]>([]);
  const [fleet, setFleet]           = useState<any[]>([]);
  const [analytics, setAnalytics]   = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [selectedTab, setSelectedTab] = useState<'live' | 'fleet' | 'analytics'>('live');
  const [selectedEmergency, setSelectedEmergency] = useState<EmergencyResponse | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { client, isConnected } = useWebSocket();

  useEffect(() => {
    loadAll();
    autoRef.current = setInterval(loadAll, 15_000); // auto-refresh every 15s
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, []);

  // Subscribe to hospital WebSocket updates
  useEffect(() => {
    if (!client || !isConnected) return;
    const sub = client.subscribe('/topic/hospital/emergencies', (msg) => {
      if (msg.body) loadAll();
    });
    return () => sub.unsubscribe();
  }, [client, isConnected]);

  const loadAll = async () => {
    try {
      const [emergencies, fleetData, analyticsData] = await Promise.all([
        getHospitalActiveEmergencies(),
        getFleetStatus(),
        getEmergencyAnalytics(),
      ]);
      setActiveEmergencies(emergencies);
      setFleet(fleetData);
      setAnalytics(analyticsData);
      setLastRefresh(new Date());
    } catch {} finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #050510 0%, #0d0d2b 100%)', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .dash-card { background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 22px; }
        .tab-btn { padding: 9px 20px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; }
        .tab-btn.active { background: rgba(59,130,246,0.2); border-color: #3b82f6; color: #60a5fa; }
        .tab-btn:hover:not(.active) { background: rgba(255,255,255,0.08); color: #fff; }
        .er-row { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 16px; padding: 14px 16px; border-radius: 14px; cursor: pointer; transition: background 0.2s; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .er-row:hover { background: rgba(255,255,255,0.05); }
        .fleet-row { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .stat-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .detail-overlay { position: fixed; right: 0; top: 0; height: 100vh; width: 420px; background: rgba(10,10,30,0.98); backdrop-filter: blur(20px); border-left: 1px solid rgba(255,255,255,0.1); padding: 24px; overflow-y: auto; z-index: 100; }
        .tl-dot { width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; flex-shrink: 0; margin-top: 5px; }
        .metric-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .live-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; animation: pulse 2s infinite; }
      `}</style>

      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Emergency Operations</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Hospital Dashboard · Medivra</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="live-dot" />
            <span style={{ fontSize: 12, color: '#22c55e' }}>Live</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Updated {lastRefresh.toLocaleTimeString()}</div>
          <button onClick={loadAll}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', color: '#fff' }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: selectedEmergency ? 'calc(100% - 440px)' : '100%', transition: 'max-width 0.3s' }}>

        {/* Quick Stats */}
        {analytics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            {[
              { label: "Today's Emergencies", value: analytics.todayEmergencies, icon: <AlertTriangle size={20}/>, color: '#ef4444' },
              { label: 'Active Right Now',    value: analytics.activeEmergencies, icon: <Zap size={20}/>,           color: '#f59e0b' },
              { label: 'Available Ambulances',value: analytics.availableAmbulances, icon: <Users size={20}/>,      color: '#22c55e' },
              { label: 'Total Fleet',         value: fleet.length,               icon: <TrendingUp size={20}/>,    color: '#3b82f6' },
            ].map((m, i) => (
              <div key={i} className="metric-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ color: m.color }}>{m.icon}</div>
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: m.color, marginTop: 12, marginBottom: 4 }}>{m.value ?? '—'}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['live', 'fleet', 'analytics'] as const).map(t => (
            <button key={t} className={`tab-btn ${selectedTab === t ? 'active' : ''}`} onClick={() => setSelectedTab(t)}>
              {t === 'live' ? `🚨 Live (${activeEmergencies.length})` : t === 'fleet' ? `🚑 Fleet (${fleet.length})` : '📊 Analytics'}
            </button>
          ))}
        </div>

        {/* ── LIVE EMERGENCIES ───────────────────────────────────────────── */}
        {selectedTab === 'live' && (
          <div className="dash-card">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>Loading…</div>
            ) : activeEmergencies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <CheckCircle size={48} color="#22c55e" style={{ marginBottom: 12 }} />
                <div style={{ color: 'rgba(255,255,255,0.5)' }}>No active emergencies</div>
              </div>
            ) : activeEmergencies.map(e => {
              const sc = STATUS_COLOR[e.status] || { bg: 'rgba(255,255,255,0.1)', text: '#fff', label: e.status };
              return (
                <div key={e.id} className="er-row" onClick={() => setSelectedEmergency(selectedEmergency?.id === e.id ? null : e)}>
                  <div style={{ fontSize: 28 }}>{EMERGENCY_ICONS[e.emergencyType] || '🚑'}</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{e.emergencyType.replace(/_/g, ' ')} Emergency</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                      📍 {e.patientLat?.toFixed(4)}, {e.patientLng?.toFixed(4)}
                      {e.patientAddress && ` · ${e.patientAddress}`}
                    </div>
                    {e.driverName && <div style={{ fontSize: 12, color: '#60a5fa', marginTop: 2 }}>🚑 {e.vehicleNumber} · {e.driverName}</div>}
                  </div>
                  <div>
                    <span className="stat-chip" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                    {e.estimatedArrivalMinutes && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4, textAlign: 'center' }}>{e.estimatedArrivalMinutes}m ETA</div>}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{new Date(e.createdAt).toLocaleTimeString()}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── FLEET ───────────────────────────────────────────────────────── */}
        {selectedTab === 'fleet' && (
          <div className="dash-card">
            {fleet.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>No ambulances registered</div>
            ) : fleet.map((amb: any) => (
              <div key={amb.id} className="fleet-row">
                <div style={{ fontSize: 24 }}>🚑</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{amb.vehicleNumber}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{amb.type} {amb.driverName ? `· ${amb.driverName}` : ''}</div>
                  {amb.lastUpdate && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Last update: {new Date(amb.lastUpdate).toLocaleTimeString()}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="stat-chip" style={{ background: amb.isOnline ? 'rgba(34,197,94,0.2)' : 'rgba(107,114,128,0.2)', color: amb.isOnline ? '#22c55e' : '#9ca3af' }}>
                    {amb.isOnline ? 'Online' : 'Offline'}
                  </span>
                  {amb.isOnline && (
                    <span className="stat-chip" style={{ background: amb.isAvailable ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: amb.isAvailable ? '#34d399' : '#f87171' }}>
                      {amb.isAvailable ? 'Available' : 'On Call'}
                    </span>
                  )}
                </div>
                {amb.lat && (
                  <a href={`https://maps.google.com/?q=${amb.lat},${amb.lng}`} target="_blank" rel="noreferrer"
                    style={{ color: '#60a5fa', fontSize: 12, textDecoration: 'none' }}>
                    <Navigation size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── ANALYTICS ───────────────────────────────────────────────────── */}
        {selectedTab === 'analytics' && analytics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            <div className="dash-card">
              <div style={{ fontWeight: 700, marginBottom: 16 }}>Emergency Volume</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Today</span>
                  <span style={{ fontWeight: 700 }}>{analytics.todayEmergencies}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Currently Active</span>
                  <span style={{ fontWeight: 700, color: '#f59e0b' }}>{analytics.activeEmergencies}</span>
                </div>
              </div>
            </div>
            <div className="dash-card">
              <div style={{ fontWeight: 700, marginBottom: 16 }}>Fleet Status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Total Fleet</span>
                  <span style={{ fontWeight: 700 }}>{fleet.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Available</span>
                  <span style={{ fontWeight: 700, color: '#22c55e' }}>{analytics.availableAmbulances}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>On Call</span>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>{fleet.filter((a: any) => !a.isAvailable && a.isOnline).length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Overlay */}
      {selectedEmergency && (
        <div className="detail-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Emergency Details</div>
            <button onClick={() => setSelectedEmergency(null)}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Emergency ID</div>
            <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{selectedEmergency.id.slice(0, 16).toUpperCase()}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Type</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedEmergency.emergencyType}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>ETA</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedEmergency.estimatedArrivalMinutes ?? '—'} min</div>
            </div>
          </div>

          {selectedEmergency.driverName && (
            <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>🚑 Ambulance</div>
              <div style={{ fontSize: 14 }}>{selectedEmergency.vehicleNumber} · {selectedEmergency.ambulanceType}</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>Driver: {selectedEmergency.driverName}</div>
              {selectedEmergency.driverPhone && (
                <a href={`tel:${selectedEmergency.driverPhone}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, color: '#60a5fa', fontSize: 13, textDecoration: 'none' }}>
                  <Phone size={13} /> {selectedEmergency.driverPhone}
                </a>
              )}
            </div>
          )}

          <a href={`https://maps.google.com/?q=${selectedEmergency.patientLat},${selectedEmergency.patientLng}`}
            target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: 14, textDecoration: 'none', color: '#34d399', marginBottom: 16, fontSize: 14 }}>
            <MapPin size={16} /> View on Google Maps
          </a>

          {selectedEmergency.timeline && selectedEmergency.timeline.length > 0 && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Timeline</div>
              {selectedEmergency.timeline.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div className="tl-dot" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.event.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{t.description}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{new Date(t.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default HospitalEmergencyDashboard;
