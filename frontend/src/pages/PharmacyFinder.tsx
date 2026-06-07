import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Phone, Package, Pill, Loader2, AlertCircle, Search,
  Navigation, Plus, Minus, CheckCircle2, ShoppingCart,
  X, Sparkles
} from 'lucide-react';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NearbyPharmacy {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  phoneNumber: string;
  inventoryCount: number;
}

interface MedicineSuggestion {
  id: string;
  name: string;
  manufacturer: string;
  strength: string;
}

interface PrescriptionItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
}

interface AllocatedItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface PharmacyAllocation {
  pharmacyId: string;
  pharmacyName: string;
  pharmacyAddress: string;
  distanceKm: number;
  score: number;
  items: AllocatedItem[];
  subtotal: number;
}

interface MatchResult {
  allSatisfied: boolean;
  allocations: PharmacyAllocation[];
  totalAmount: number;
  unsatisfiedMedicineIds: string[];
}

type Tab = 'nearby' | 'match';

// ── Component ─────────────────────────────────────────────────────────────────

const PharmacyFinder: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('nearby');

  // ── Nearby Tab State ──────────────────────────────────────────────────────
  const [nearby, setNearby] = useState<NearbyPharmacy[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [radius, setRadius] = useState(20);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  // ── Smart Match Tab State ────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MedicineSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [basket, setBasket] = useState<PrescriptionItem[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [matchLocation, setMatchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeMapPharmacyId, setActiveMapPharmacyId] = useState<string | null>(null);
  const [matchGeoLoading, setMatchGeoLoading] = useState(false);

  // ── Geolocation helpers ───────────────────────────────────────────────────

  const requestLocation = useCallback((
    onSuccess: (lat: number, lng: number) => void,
    setLoading: (v: boolean) => void,
    setError: (e: string) => void
  ) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported. Please search manually.');
      return;
    }
    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSuccess(pos.coords.latitude, pos.coords.longitude);
        setLoading(false);
      },
      () => {
        setError('Location access denied. Please allow location or enter manually.');
        setLoading(false);
      }
    );
  }, []);

  // Auto-detect location on first load
  useEffect(() => {
    requestLocation(
      (lat, lng) => setUserLocation({ lat, lng }),
      setGeoLoading,
      setGeoError
    );
  }, [requestLocation]);

  // Fetch nearby pharmacies when location changes
  useEffect(() => {
    if (!userLocation) return;
    const fetchNearby = async () => {
      try {
        setNearbyLoading(true);
        setNearbyError('');
        const res = await api.get(`/pharmacies/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&radiusKm=${radius}`);
        if (res.data.success) setNearby(res.data.data);
      } catch {
        setNearbyError('Failed to load nearby pharmacies.');
      } finally {
        setNearbyLoading(false);
      }
    };
    fetchNearby();
  }, [userLocation, radius]);

  // ── Medicine autocomplete ─────────────────────────────────────────────────

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        setSuggestLoading(true);
        const res = await api.get(`/medicines/search?q=${encodeURIComponent(query)}`);
        if (res.data.success) setSuggestions(res.data.data);
      } catch { /* ignore */ }
      finally { setSuggestLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const addToBasket = (med: MedicineSuggestion) => {
    setBasket(prev => {
      if (prev.find(i => i.medicineId === med.id)) return prev;
      return [...prev, { medicineId: med.id, medicineName: med.name, quantity: 1 }];
    });
    setQuery('');
    setSuggestions([]);
    setMatchResult(null);
  };

  const updateQty = (medicineId: string, delta: number) => {
    setBasket(prev => prev.map(item =>
      item.medicineId === medicineId
        ? { ...item, quantity: Math.max(1, item.quantity + delta) }
        : item
    ));
    setMatchResult(null);
  };

  const removeFromBasket = (medicineId: string) => {
    setBasket(prev => prev.filter(i => i.medicineId !== medicineId));
    setMatchResult(null);
  };

  const handleMatch = async () => {
    if (basket.length === 0) { setMatchError('Add at least one medicine.'); return; }
    const loc = matchLocation || userLocation;
    if (!loc) { setMatchError('Location is required. Please allow GPS access.'); return; }
    try {
      setMatchLoading(true);
      setMatchError('');
      setMatchResult(null);
      const res = await api.post('/pharmacies/match', {
        userLatitude: loc.lat,
        userLongitude: loc.lng,
        radiusKm: 30,
        medicines: basket.map(b => ({ medicineId: b.medicineId, quantity: b.quantity })),
      });
      if (res.data.success) setMatchResult(res.data.data);
    } catch (err: any) {
      setMatchError(err.response?.data?.message || 'Match failed. Please try again.');
    } finally {
      setMatchLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const tabClass = (t: Tab) =>
    `flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
      activeTab === t
        ? 'bg-white text-indigo-700 shadow-md'
        : 'text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-700 to-purple-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Pill className="h-4 w-4" /> Pharmacy Finder
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Find Medicines Near You</h1>
          <p className="text-indigo-200 text-base max-w-xl mx-auto">
            Discover nearby pharmacies or use our smart prescription matcher to find the best availability.
          </p>

          {/* Tab Toggle */}
          <div className="mt-8 inline-flex bg-indigo-800/60 backdrop-blur rounded-2xl p-1.5 gap-1">
            <button
              id="tab-nearby"
              onClick={() => setActiveTab('nearby')}
              className={tabClass('nearby')}
            >
              <Navigation className="h-4 w-4" /> Nearby Pharmacies
            </button>
            <button
              id="tab-match"
              onClick={() => setActiveTab('match')}
              className={tabClass('match')}
            >
              <Sparkles className="h-4 w-4" /> Smart Prescription Match
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── NEARBY TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'nearby' && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className={`p-2 rounded-xl ${userLocation ? 'bg-green-50' : 'bg-slate-50'}`}>
                  <Navigation className={`h-5 w-5 ${userLocation ? 'text-green-600' : 'text-slate-400'}`} />
                </div>
                <div>
                  {geoLoading ? (
                    <p className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Detecting your location…
                    </p>
                  ) : userLocation ? (
                    <p className="text-sm font-semibold text-green-700">📍 Location detected — showing nearby pharmacies</p>
                  ) : (
                    <p className="text-sm font-semibold text-slate-600">Location not yet detected</p>
                  )}
                  {geoError && <p className="text-xs text-red-500 mt-0.5">{geoError}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-500">Radius:</label>
                  <select
                    value={radius}
                    onChange={e => setRadius(Number(e.target.value))}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700"
                  >
                    {[5, 10, 20, 30, 50].map(r => (
                      <option key={r} value={r}>{r} km</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => requestLocation(
                    (lat, lng) => setUserLocation({ lat, lng }),
                    setGeoLoading,
                    setGeoError
                  )}
                  disabled={geoLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 text-xs font-semibold hover:bg-indigo-50 transition-colors disabled:opacity-60"
                >
                  {geoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
                  Re-detect
                </button>
              </div>
            </div>

            {/* Results */}
            {nearbyLoading ? (
              <div className="flex flex-col items-center py-24 gap-3">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-indigo-100" />
                  <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                </div>
                <p className="text-slate-500 text-sm">Finding pharmacies near you…</p>
              </div>
            ) : nearbyError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm">{nearbyError}</p>
              </div>
            ) : !userLocation ? (
              <div className="text-center py-24">
                <Navigation className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700 mb-2">Allow Location Access</h3>
                <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
                  We need your location to find pharmacies near you.
                </p>
                <button
                  onClick={() => requestLocation((lat, lng) => setUserLocation({ lat, lng }), setGeoLoading, setGeoError)}
                  disabled={geoLoading}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                >
                  {geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                  Allow Location
                </button>
              </div>
            ) : nearby.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <Package className="h-14 w-14 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700 mb-1">No pharmacies found</h3>
                <p className="text-slate-400 text-sm">Try increasing the search radius.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500">
                  Found <span className="font-semibold text-slate-800">{nearby.length}</span> pharmacies within {radius} km
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {nearby.map((pharm, idx) => (
                    <div
                      key={pharm.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all overflow-hidden group"
                    >
                      <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-6 h-6 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <h3 className="font-bold text-slate-900 text-base group-hover:text-indigo-700 transition-colors">
                                {pharm.name}
                              </h3>
                            </div>
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {pharm.address}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-lg font-bold text-indigo-600">{pharm.distanceKm}</span>
                            <span className="text-xs text-slate-400"> km</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">
                            <Package className="h-3.5 w-3.5 text-indigo-400" />
                            {pharm.inventoryCount} medicines
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">
                            <Phone className="h-3.5 w-3.5 text-green-500" />
                            {pharm.phoneNumber}
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() => setActiveMapPharmacyId(activeMapPharmacyId === pharm.id ? null : pharm.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 py-2 rounded-xl transition-colors border border-indigo-100 cursor-pointer"
                          >
                            <MapPin className="h-3.5 w-3.5" /> {activeMapPharmacyId === pharm.id ? 'Hide Map' : 'View Map'}
                          </button>
                          <a
                            href={`https://maps.google.com/?q=${pharm.latitude},${pharm.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 py-2 rounded-xl transition-colors border border-slate-200"
                          >
                            Google Maps
                          </a>
                        </div>
                        {activeMapPharmacyId === pharm.id && (
                          <div className="mt-3 w-full h-48 rounded-xl overflow-hidden border border-slate-200">
                            <iframe
                              title={`Map for ${pharm.name}`}
                              width="100%"
                              height="100%"
                              style={{ border: 0 }}
                              src={`https://maps.google.com/maps?q=${pharm.latitude},${pharm.longitude}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── SMART MATCH TAB ────────────────────────────────────────────────── */}
        {activeTab === 'match' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left — Build Prescription */}
            <div className="lg:col-span-2 space-y-5">
              {/* Location for match */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Location</p>
                  <button
                    onClick={() => requestLocation(
                      (lat, lng) => setMatchLocation({ lat, lng }),
                      setMatchGeoLoading,
                      () => {}
                    )}
                    disabled={matchGeoLoading}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    {matchGeoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
                    {matchLocation || userLocation ? 'Re-detect' : 'Detect Location'}
                  </button>
                </div>
                {matchGeoLoading ? (
                  <p className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" /> Detecting…
                  </p>
                ) : (matchLocation || userLocation) ? (
                  <p className="text-sm font-semibold text-green-700">📍 Location detected</p>
                ) : (
                  <p className="text-sm text-amber-600 font-medium">⚠ Location required for matching</p>
                )}
              </div>

              {/* Medicine search */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Search className="h-4 w-4 text-indigo-500" /> Add Medicines
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  {suggestLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400 animate-spin" />
                  )}
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search medicine name…"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                      {suggestions.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => addToBasket(m)}
                          className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-slate-100 last:border-b-0 transition-colors"
                        >
                          <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.manufacturer} {m.strength && `· ${m.strength}`}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">Type at least 2 characters to search registered medicines.</p>
              </div>

              {/* Basket */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-indigo-500" /> Prescription Basket
                    {basket.length > 0 && (
                      <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        {basket.length}
                      </span>
                    )}
                  </h3>
                </div>

                {basket.length === 0 ? (
                  <div className="text-center py-10 px-5">
                    <Pill className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Search and add medicines above.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {basket.map(item => (
                      <div key={item.medicineId} className="flex items-center gap-3 px-5 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.medicineName}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-0.5">
                          <button
                            onClick={() => updateQty(item.medicineId, -1)}
                            className="p-1.5 rounded-lg hover:bg-white transition-colors text-slate-500 hover:text-slate-700"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm font-bold text-slate-700">{item.quantity}</span>
                          <button
                            onClick={() => updateQty(item.medicineId, 1)}
                            className="p-1.5 rounded-lg hover:bg-white transition-colors text-slate-500 hover:text-slate-700"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromBasket(item.medicineId)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {basket.length > 0 && (
                  <div className="p-4 border-t border-slate-100">
                    {matchError && (
                      <p className="text-xs text-red-600 mb-3 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" /> {matchError}
                      </p>
                    )}
                    <button
                      id="find-pharmacy-match-btn"
                      onClick={handleMatch}
                      disabled={matchLoading}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-60"
                    >
                      {matchLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Finding best pharmacies…</>
                      ) : (
                        <><Sparkles className="h-4 w-4" /> Find Best Match</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right — Results */}
            <div className="lg:col-span-3 space-y-5">
              {matchLoading && (
                <div className="flex flex-col items-center py-24 gap-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-purple-100" />
                    <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-purple-600 border-t-transparent animate-spin" />
                    <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-purple-600" />
                  </div>
                  <p className="text-slate-500 text-sm">Analysing nearby pharmacies…</p>
                </div>
              )}

              {matchResult && !matchLoading && (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`rounded-2xl px-5 py-4 flex items-center gap-3 ${
                    matchResult.allSatisfied
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-amber-50 border border-amber-200'
                  }`}>
                    {matchResult.allSatisfied ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <p className={`font-bold text-sm ${matchResult.allSatisfied ? 'text-green-800' : 'text-amber-800'}`}>
                        {matchResult.allSatisfied ? 'All medicines matched!' : 'Partial match — some medicines unavailable'}
                      </p>
                      <p className={`text-xs mt-0.5 ${matchResult.allSatisfied ? 'text-green-600' : 'text-amber-600'}`}>
                        {matchResult.allSatisfied
                          ? `Found across ${matchResult.allocations.length} pharmacy${matchResult.allocations.length > 1 ? 'ies' : ''}.`
                          : `${matchResult.unsatisfiedMedicineIds.length} medicine(s) not available nearby.`
                        }
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-slate-500">Grand Total</p>
                      <p className="text-xl font-bold text-slate-900">₹{Number(matchResult.totalAmount).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Allocation Cards */}
                  {matchResult.allocations.map((alloc, idx) => (
                    <div key={alloc.pharmacyId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      {/* Card Header */}
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-4 border-b border-indigo-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 bg-indigo-600 text-white text-sm font-bold rounded-full flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <div>
                              <h4 className="font-bold text-slate-900">{alloc.pharmacyName}</h4>
                              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3" /> {alloc.pharmacyAddress}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setActiveMapPharmacyId(activeMapPharmacyId === alloc.pharmacyId ? null : alloc.pharmacyId)}
                              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100 cursor-pointer animate-fade-in"
                            >
                              <MapPin className="h-3.5 w-3.5" /> {activeMapPharmacyId === alloc.pharmacyId ? 'Hide Map' : 'Map'}
                            </button>
                            <div className="text-right">
                              <p className="text-xs text-slate-400">Distance</p>
                              <p className="font-bold text-indigo-600">{alloc.distanceKm} km</p>
                            </div>
                          </div>
                        </div>
                        {activeMapPharmacyId === alloc.pharmacyId && (
                          <div className="mt-3 w-full h-48 rounded-xl overflow-hidden border border-slate-200 bg-white">
                            <iframe
                              title={`Map for ${alloc.pharmacyName}`}
                              width="100%"
                              height="100%"
                              style={{ border: 0 }}
                              src={`https://maps.google.com/maps?q=${encodeURIComponent(alloc.pharmacyAddress)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                            />
                          </div>
                        )}
                      </div>

                      {/* Items */}
                      <div className="divide-y divide-slate-100">
                        {alloc.items.map(item => (
                          <div key={item.medicineId} className="flex items-center justify-between px-5 py-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{item.medicineName}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {item.quantity} × ₹{Number(item.unitPrice).toFixed(2)}
                              </p>
                            </div>
                            <p className="font-bold text-slate-700">₹{Number(item.lineTotal).toFixed(2)}</p>
                          </div>
                        ))}
                      </div>

                      {/* Subtotal */}
                      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-500">Subtotal</p>
                        <p className="font-bold text-lg text-indigo-700">₹{Number(alloc.subtotal).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}

                  {/* Grand Total Card */}
                  {matchResult.allocations.length > 1 && (
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl px-6 py-5 flex items-center justify-between shadow-lg">
                      <div>
                        <p className="text-indigo-200 text-sm font-semibold">Grand Total</p>
                        <p className="text-xs text-indigo-300 mt-0.5">{matchResult.allocations.length} pharmacies</p>
                      </div>
                      <p className="text-3xl font-bold">₹{Number(matchResult.totalAmount).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              )}

              {!matchResult && !matchLoading && (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 text-center py-24 px-8">
                  <Sparkles className="h-14 w-14 text-slate-200 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-700 mb-2">Smart Prescription Matching</h3>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto">
                    Add medicines to your basket and click <strong>Find Best Match</strong>. Our algorithm will optimise across nearby pharmacies for the best availability and lowest cost.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PharmacyFinder;
