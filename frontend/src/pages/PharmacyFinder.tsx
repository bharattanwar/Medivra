import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Phone, Package, Pill, Loader2, AlertCircle, Search,
  Navigation, Plus, Minus, CheckCircle2, ShoppingCart,
  X, Sparkles, FileText, Upload
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

interface MedivraPrescription {
  id: string;
  appointmentId?: string;
  doctorId?: string;
  patientId: string;
  filePath: string;
  fileType: string;
  notes?: string;
  createdAt: string;
}

interface IdentifiedItem {
  name: string;
  strength: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
}

type Tab = 'nearby' | 'match';
type MatchMode = 'prescription' | 'manual';
type PrescriptionSource = 'select' | 'upload';

// ── Component ─────────────────────────────────────────────────────────────────

const PharmacyFinder: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('match');

  // ── Nearby Tab State ──────────────────────────────────────────────────────
  const [nearby, setNearby] = useState<NearbyPharmacy[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [radius, setRadius] = useState(20);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  // ── Smart Match Tab State ────────────────────────────────────────────────
  const [matchMode, setMatchMode] = useState<MatchMode>('prescription');
  const [prescriptionSource, setPrescriptionSource] = useState<PrescriptionSource>('select');

  // Consultation Prescription Select
  const [prescriptions, setPrescriptions] = useState<MedivraPrescription[]>([]);
  const [prescLoading, setPrescLoading] = useState(false);
  const [selectedPrescId, setSelectedPrescId] = useState<string>('');

  // External Upload Prescription
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');

  // Verified / Identified Items Editor List
  const [identifiedItems, setIdentifiedItems] = useState<IdentifiedItem[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);

  // Manual Basket Search
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MedicineSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [basket, setBasket] = useState<PrescriptionItem[]>([]);

  // Optimization Results
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [matchLocation, setMatchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeMapPharmacyId, setActiveMapPharmacyId] = useState<string | null>(null);
  const [matchGeoLoading, setMatchGeoLoading] = useState(false);

  // Checkout State
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const patientId = localStorage.getItem('userId');

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

  // Load Patient Prescriptions list
  useEffect(() => {
    if (!patientId || matchMode !== 'prescription' || prescriptionSource !== 'select') return;
    const fetchPrescriptions = async () => {
      try {
        setPrescLoading(true);
        const res = await api.get(`/records/patient/${patientId}`);
        setPrescriptions(res.data);
      } catch (err) {
        console.error('Failed to load patient prescriptions', err);
      } finally {
        setPrescLoading(false);
      }
    };
    fetchPrescriptions();
  }, [patientId, matchMode, prescriptionSource]);

  // Handle Prescription Selection change
  const handlePrescriptionSelect = async (recordId: string) => {
    setSelectedPrescId(recordId);
    if (!recordId) {
      setIdentifiedItems([]);
      setActiveRecordId(null);
      return;
    }
    try {
      setVerifying(true);
      const res = await api.get(`/records/${recordId}/items`);
      if (res.data) {
        const items = res.data.map((item: any) => ({
          name: item.medicineName,
          strength: item.strength || '',
          dosage: item.dosage || '1 tablet',
          frequency: item.frequency || '1-0-1',
          duration: item.duration || '5 days',
          quantity: 10 // default purchase quantity
        }));
        setIdentifiedItems(items);
        setActiveRecordId(recordId);
      }
    } catch (err) {
      console.error(err);
      alert('Could not retrieve items for this prescription.');
    } finally {
      setVerifying(false);
    }
  };

  // Handle External Prescription Upload with simulated AI OCR loader
  const handleExternalUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !patientId) return;
    try {
      setUploadLoading(true);
      setUploadProgressMsg('Uploading prescription file securely...');
      await new Promise(r => setTimeout(r, 600));
      setUploadProgressMsg('Running AI-OCR Medical Scanning model...');
      await new Promise(r => setTimeout(r, 700));
      setUploadProgressMsg('Extracting pharmaceutical formulations & dosages...');
      await new Promise(r => setTimeout(r, 600));

      const formData = new FormData();
      formData.append('patientId', patientId);
      formData.append('notes', uploadNotes);
      formData.append('file', uploadFile);

      const res = await api.post('/records/upload-external', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data) {
        const record = res.data;
        const itemsRes = await api.get(`/records/${record.id}/items`);
        const items = itemsRes.data.map((item: any) => ({
          name: item.medicineName,
          strength: item.strength || '',
          dosage: item.dosage || '1 tablet',
          frequency: item.frequency || '1-0-1',
          duration: item.duration || '5 days',
          quantity: 10
        }));
        setIdentifiedItems(items);
        setActiveRecordId(record.id);
        setUploadFile(null);
        setUploadNotes('');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload/analyze prescription.');
    } finally {
      setUploadLoading(false);
      setUploadProgressMsg('');
    }
  };

  // ── Medicine autocomplete (Manual Basket) ──────────────────────────────────

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
      return [...prev, { medicineId: med.id, medicineName: med.name, quantity: 10 }];
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

  // Optimize & Search Fulfillments from Prescription verified items
  const handleResolveAndMatch = async () => {
    if (identifiedItems.length === 0) {
      alert('Prescription has no medicines.');
      return;
    }
    const loc = matchLocation || userLocation;
    if (!loc) {
      setMatchError('Location is required. Please allow GPS access.');
      return;
    }
    try {
      setMatchLoading(true);
      setMatchError('');
      setMatchResult(null);

      // 1. Resolve names to medicine IDs in database
      const resolvePayload = identifiedItems.map(item => ({
        name: item.name,
        strength: item.strength
      }));
      const resolveRes = await api.post('/medicines/resolve', resolvePayload);
      const resolvedList = resolveRes.data.data;

      // Map verified quantities to the resolved IDs
      const finalBasket = resolvedList.map((m: any, idx: number) => ({
        medicineId: m.id,
        quantity: identifiedItems[idx].quantity
      }));

      // If we have an active record ID, verify the items in the backend records too
      if (activeRecordId) {
        await api.put(`/records/${activeRecordId}/verify-items`, identifiedItems.map(item => ({
          name: item.name,
          strength: item.strength,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration
        })));
      }

      // 2. Query Match Optimization API
      const matchRes = await api.post('/pharmacies/match', {
        userLatitude: loc.lat,
        userLongitude: loc.lng,
        radiusKm: 30,
        medicines: finalBasket
      });

      if (matchRes.data.success) {
        setMatchResult(matchRes.data.data);
      }
    } catch (err: any) {
      setMatchError(err.response?.data?.message || 'Matching algorithm failed. Try again.');
    } finally {
      setMatchLoading(false);
    }
  };

  // Perform Manual search match
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

  // Place single checkout order
  const handleCheckout = async () => {
    if (!matchResult || !deliveryAddress.trim() || !patientId) return;
    const loc = matchLocation || userLocation;
    if (!loc) return;

    try {
      setCheckoutLoading(true);
      
      // Build order items
      const checkoutItems: any[] = [];
      matchResult.allocations.forEach(alloc => {
        alloc.items.forEach(item => {
          checkoutItems.push({
            pharmacyId: alloc.pharmacyId,
            medicineId: item.medicineId,
            quantity: item.quantity,
            price: item.unitPrice
          });
        });
      });

      const payload = {
        patientId,
        prescriptionId: activeRecordId || null,
        deliveryAddress: deliveryAddress.trim(),
        userLatitude: loc.lat,
        userLongitude: loc.lng,
        items: checkoutItems
      };

      const res = await api.post('/medicine-orders/checkout', payload);
      if (res.data.success) {
        setCheckoutSuccess(true);
        setTimeout(() => {
          setCheckoutSuccess(false);
          setBasket([]);
          setIdentifiedItems([]);
          setMatchResult(null);
          navigate('/patient/orders');
        }, 2000);
      }
    } catch (err) {
      console.error(err);
      alert('Checkout failed. Please check payment/delivery detail details.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Render helpers
  const tabClass = (t: Tab) =>
    `flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
      activeTab === t
        ? 'bg-white text-indigo-750 shadow-md'
        : 'text-slate-500 hover:text-slate-700'
    }`;

  const modeBtnClass = (m: MatchMode) =>
    `flex-1 py-3 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${
      matchMode === m
        ? 'border-indigo-600 text-indigo-600 bg-indigo-50/10'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`;

  const sourceBtnClass = (s: PrescriptionSource) =>
    `flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
      prescriptionSource === s
        ? 'bg-indigo-600 text-white shadow'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`;

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Pill className="h-4 w-4" /> Medicine Ecosystem
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Order Prescription Medicines</h1>
          <p className="text-indigo-200 text-base max-w-xl mx-auto">
            Upload your doctor's prescription or search for medicines directly. We'll find and optimize fulfillment routes across nearby pharmacies.
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
              <Sparkles className="h-4 w-4" /> Order Medicines
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
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 bg-white"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 text-xs font-semibold hover:bg-indigo-50 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {geoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
                  Re-detect
                </button>
              </div>
            </div>

            {/* Results */}
            {nearbyLoading ? (
              <div className="flex flex-col items-center py-24 gap-3">
                <div className="h-16 w-16 border-4 border-indigo-100 rounded-full animate-spin border-t-indigo-600" />
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
            
            {/* Left Column — Selection, Upload or Manual Addition */}
            <div className="lg:col-span-2 space-y-5">
              
              {/* Location configuration */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delivery Location</p>
                  <button
                    onClick={() => requestLocation(
                      (lat, lng) => setMatchLocation({ lat, lng }),
                      setMatchGeoLoading,
                      () => {}
                    )}
                    disabled={matchGeoLoading}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
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
                  <p className="text-sm text-amber-600 font-medium">⚠ Location required for pharmacy optimization</p>
                )}
              </div>

              {/* Mode Selector */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex shrink-0">
                <button
                  type="button"
                  onClick={() => { setMatchMode('prescription'); setMatchResult(null); }}
                  className={modeBtnClass('prescription')}
                >
                  <FileText className="h-4 w-4" /> Order by Prescription
                </button>
                <button
                  type="button"
                  onClick={() => { setMatchMode('manual'); setMatchResult(null); }}
                  className={modeBtnClass('manual')}
                >
                  <Search className="h-4 w-4" /> Manual Search
                </button>
              </div>

              {/* Pathway 1: Order by Prescription (Select Medivra Consultation or Upload External) */}
              {matchMode === 'prescription' && (
                <div className="space-y-4">
                  {/* Select/Upload Toggle */}
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => { setPrescriptionSource('select'); setIdentifiedItems([]); setSelectedPrescId(''); }}
                      className={sourceBtnClass('select')}
                    >
                      Medivra Consultation
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPrescriptionSource('upload'); setIdentifiedItems([]); setSelectedPrescId(''); }}
                      className={sourceBtnClass('upload')}
                    >
                      Upload External Prescription
                    </button>
                  </div>

                  {/* Mode A: Select Medivra Prescription */}
                  {prescriptionSource === 'select' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-indigo-600" /> Select Previous Prescription
                      </h3>
                      {prescLoading ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                        </div>
                      ) : prescriptions.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">
                          No generated prescriptions found from consults. Try uploading one.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-slate-500">Consultation Date & Notes</label>
                          <select
                            value={selectedPrescId}
                            onChange={e => handlePrescriptionSelect(e.target.value)}
                            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                          >
                            <option value="">-- Choose a prescription --</option>
                            {prescriptions.map(p => (
                              <option key={p.id} value={p.id}>
                                {new Date(p.createdAt).toLocaleDateString('en-IN')} - {p.notes?.slice(0, 30) || 'Digital Prescription'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode B: Upload External Prescription */}
                  {prescriptionSource === 'upload' && (
                    <form onSubmit={handleExternalUpload} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <Upload className="h-4 w-4 text-indigo-600" /> Upload PDF / Image
                      </h3>
                      
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-500">Prescription File (PDF/JPG)</label>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={e => setUploadFile(e.target.files?.[0] || null)}
                          className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-500">Notes / Medical Advice (Optional)</label>
                        <input
                          type="text"
                          value={uploadNotes}
                          onChange={e => setUploadNotes(e.target.value)}
                          placeholder="e.g. For allergy, 2 tablets daily..."
                          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      {uploadLoading ? (
                        <div className="bg-indigo-50 rounded-xl p-3 flex items-center gap-3">
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                          <span className="text-xs font-bold text-indigo-700 animate-pulse">{uploadProgressMsg}</span>
                        </div>
                      ) : (
                        <button
                          type="submit"
                          disabled={!uploadFile}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-colors"
                        >
                          Upload & Extract Medicines
                        </button>
                      )}
                    </form>
                  )}
                </div>
              )}

              {/* Pathway 2: Manual Basket Addition */}
              {matchMode === 'manual' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
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
                      <div className="absolute z-25 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
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

                  {/* Manual Basket List */}
                  {basket.length > 0 && (
                    <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50/20">
                      {basket.map(item => (
                        <div key={item.medicineId} className="flex items-center justify-between p-3">
                          <p className="text-xs font-semibold text-slate-800 truncate max-w-[150px]">{item.medicineName}</p>
                          <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => updateQty(item.medicineId, -5)}
                              className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-700"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-slate-700">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQty(item.medicineId, 5)}
                              className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-700"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromBasket(item.medicineId)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {matchError && (
                        <div className="p-3 bg-red-50 text-red-700 text-xs border-t border-slate-100 flex items-center gap-1.5 font-semibold">
                          <AlertCircle className="h-4 w-4 text-red-500" /> {matchError}
                        </div>
                      )}
                      <div className="p-3 bg-white">
                        <button
                          type="button"
                          onClick={handleMatch}
                          disabled={matchLoading}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer"
                        >
                          Find Best Match
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Prescription Items Verification Screen */}
              {matchMode === 'prescription' && (
                verifying ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center text-slate-500 text-xs font-semibold flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Scanning prescription items...
                  </div>
                ) : identifiedItems.length > 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-scale-in">
                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-indigo-600" /> Verify Prescription Medicines
                      </h3>
                    </div>

                    <div className="p-4 divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {identifiedItems.map((item, idx) => (
                        <div key={idx} className="py-3 flex flex-col gap-1.5">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-bold text-slate-800">{item.name}</p>
                              <p className="text-[10px] text-slate-400">
                                {item.strength && `${item.strength} · `}{item.dosage} · {item.frequency} · {item.duration}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIdentifiedItems(prev => prev.filter((_, i) => i !== idx))}
                              className="text-slate-300 hover:text-red-500 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-1 justify-end">
                            <label className="text-[10px] text-slate-500 font-bold">Qty to order:</label>
                            <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setIdentifiedItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 5) } : it));
                                }}
                                className="p-1 rounded bg-white text-slate-500"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-[11px] font-bold text-slate-700">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIdentifiedItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 5 } : it));
                                }}
                                className="p-1 rounded bg-white text-slate-500"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {matchError && (
                      <div className="p-3 bg-red-50 text-red-750 text-xs border-t border-slate-100 flex items-center gap-1.5 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" /> {matchError}
                      </div>
                    )}

                    <div className="p-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleResolveAndMatch}
                        disabled={matchLoading}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 rounded-xl font-bold text-xs shadow cursor-pointer hover:shadow-md transition-all"
                      >
                        {matchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Optimize & Find Pharmacies
                      </button>
                    </div>
                  </div>
                ) : null
              )}
            </div>

            {/* Right Column — Results & Checkout */}
            <div className="lg:col-span-3 space-y-5 animate-fade-in">
              {matchLoading && (
                <div className="flex flex-col items-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm gap-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-purple-100 border-t-purple-600 animate-spin" />
                    <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-purple-600 animate-pulse" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">Analysing pharmacy inventories near you…</p>
                </div>
              )}

              {matchResult && !matchLoading && (
                <div className="space-y-5">
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
                        {matchResult.allSatisfied ? 'All medicines matched successfully!' : 'Partial match — some medicines unavailable'}
                      </p>
                      <p className={`text-xs mt-0.5 ${matchResult.allSatisfied ? 'text-green-600' : 'text-amber-600'}`}>
                        {matchResult.allSatisfied
                          ? `Fulfillment optimized across ${matchResult.allocations.length} pharmacy${matchResult.allocations.length > 1 ? 'ies' : ''}.`
                          : `${matchResult.unsatisfiedMedicineIds.length} medicine(s) not available nearby.`
                        }
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Subtotal</p>
                      <p className="text-xl font-black text-slate-900">₹{Number(matchResult.totalAmount).toFixed(2)}</p>
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
                          <div key={item.medicineId} className="flex items-center justify-between px-5 py-3 bg-white">
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

                  {/* Checkout Form */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <ShoppingCart className="h-4 w-4 text-indigo-600" /> Unified Checkout
                    </h3>
                    
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-500">Delivery Address</label>
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={e => setDeliveryAddress(e.target.value)}
                        placeholder="Enter your complete home/office delivery address..."
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                        required
                      />
                    </div>

                    {checkoutSuccess ? (
                      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                        ✓ Checkout successful! Redirecting to tracking center…
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={checkoutLoading || !deliveryAddress.trim()}
                        className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {checkoutLoading ? 'Processing Checkout Payment…' : `Place Order (₹${Number(matchResult.totalAmount).toFixed(2)})`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!matchResult && !matchLoading && (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 text-center py-24 px-8">
                  <Sparkles className="h-14 w-14 text-indigo-300 mx-auto mb-4 animate-pulse" />
                  <h3 className="text-lg font-bold text-slate-700 mb-2">Automated Prescription Fulfillment</h3>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                    Select a previous consult prescription or upload an external prescription sheet. Our engine will verify the medicines and map the cheapest and fastest multi-pharmacy deliveries.
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
