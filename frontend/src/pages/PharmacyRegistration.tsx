import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MapPin, Phone, Mail, Lock, User, Building2,
  Crosshair, Loader2, ChevronRight, CheckCircle2, AlertCircle, Search
} from 'lucide-react';
import api from '../services/api';

interface FormData {
  fullName: string;
  email: string;
  password: string;
  name: string;
  address: string;
  phoneNumber: string;
}

// Defined OUTSIDE component to prevent remount-on-keystroke focus loss
interface InputFieldProps {
  label: string;
  name: keyof FormData;
  type?: string;
  placeholder: string;
  icon: React.ElementType;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const InputField: React.FC<InputFieldProps> = ({
  label, name, type = 'text', placeholder, icon: Icon, value, onChange,
}) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
      {label}
    </label>
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        autoComplete="off"
        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all"
      />
    </div>
  </div>
);

// ── Geocode an address string using OSM Nominatim (free, no API key) with Smart Fallback ──────────
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  let currentSearch = address;
  
  // Try up to 3 times, stripping the first segment (before the comma) to broaden the search
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!currentSearch.trim()) break;
    
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(currentSearch.trim())}&format=json&limit=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (err) {
      console.warn("Geocode attempt failed:", err);
    }
    
    // If not found, strip the most specific part (everything before the first comma)
    const commaIndex = currentSearch.indexOf(',');
    if (commaIndex === -1) break; // No more commas to split by
    
    currentSearch = currentSearch.substring(commaIndex + 1);
  }
  
  return null;
}

const PharmacyRegistration: React.FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormData>({
    fullName: '',
    email: '',
    password: '',
    name: '',
    address: '',
    phoneNumber: '',
  });

  // lat/lng stored silently — never exposed as raw number inputs
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [coordSource, setCoordSource] = useState<'gps' | 'geocode' | 'manual' | null>(null);

  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [geocodeError, setGeocodeError] = useState('');
  const [error, setError] = useState('');

  // Custom address query for geocoding (pre-filled from Step 2 address, but editable)
  const [geocodeQuery, setGeocodeQuery] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    // Keep geocode query in sync with address field if not yet manually changed
    if (e.target.name === 'address') {
      setGeocodeQuery(e.target.value);
    }
  };

  // GPS auto-detect
  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    setCoords(null);
    setCoordSource(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCoordSource('gps');
        setGeoLoading(false);
      },
      () => {
        setGeoError('Location access denied. Please allow location permissions and try again.');
        setGeoLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Address → lat/lng geocoding
  const handleGeocode = async () => {
    const q = geocodeQuery.trim();
    if (!q) { setGeocodeError('Please enter an address to look up.'); return; }
    setGeocodeLoading(true);
    setGeocodeError('');
    setCoords(null);
    setCoordSource(null);
    try {
      const result = await geocodeAddress(q);
      if (!result) {
        setGeocodeError('Address not found. Try a more specific address (city, state, country).');
      } else {
        setCoords(result);
        setCoordSource('geocode');
      }
    } catch {
      setGeocodeError('Failed to look up address. Check your connection and try again.');
    } finally {
      setGeocodeLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) {
      setError('Please set your pharmacy location coordinates. Use the Look Up or GPS button below.');
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.post('/pharmacies/register', {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        name: form.name,
        address: form.address,
        latitude: coords.lat,
        longitude: coords.lng,
        phoneNumber: form.phoneNumber,
      });
      if (response.data.success) {
        const { token, role, userId } = response.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('role', role);
        localStorage.setItem('userId', userId);
        navigate('/pharmacy/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-900 flex items-center justify-center p-4">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500 rounded-full opacity-10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full opacity-10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-white/20 rounded-xl">
                  <Building2 className="h-6 w-6" />
                </div>
                <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">Pharmacy Partner</span>
              </div>
              <h1 className="text-3xl font-bold mb-1">Register Your Pharmacy</h1>
              <p className="text-indigo-200 text-sm">Join Medivra's pharmacy network and reach more patients</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" /> {error}
              </div>
            )}

            {/* Step 1 — Owner Details */}
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                Owner Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Full Name" name="fullName" placeholder="Your full name"
                  icon={User} value={form.fullName} onChange={handleChange}
                />
                <InputField
                  label="Email Address" name="email" type="email" placeholder="owner@pharmacy.com"
                  icon={Mail} value={form.email} onChange={handleChange}
                />
                <div className="sm:col-span-2">
                  <InputField
                    label="Password" name="password" type="password" placeholder="Create a strong password"
                    icon={Lock} value={form.password} onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Step 2 — Pharmacy Details */}
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                Pharmacy Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Pharmacy Name" name="name" placeholder="e.g. Apollo Pharmacy"
                  icon={Building2} value={form.name} onChange={handleChange}
                />
                <InputField
                  label="Phone Number" name="phoneNumber" placeholder="+91 98765 43210"
                  icon={Phone} value={form.phoneNumber} onChange={handleChange}
                />
                <div className="sm:col-span-2">
                  <InputField
                    label="Full Address" name="address" placeholder="e.g. 12 MG Road, Bengaluru, Karnataka 560001"
                    icon={MapPin} value={form.address} onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Step 3 — Location */}
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  Set Pharmacy Location
                </h2>
                <p className="text-xs text-slate-400">
                  We store your coordinates to help patients measure distance. Use GPS, search an address, or type coordinates manually.
                </p>
              </div>

              {/* Option A — Geocode from address */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-white">
                <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-indigo-500" /> Locate by Address Search
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={geocodeQuery}
                      onChange={e => { setGeocodeQuery(e.target.value); setGeocodeError(''); }}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGeocode())}
                      placeholder="Type full address including city & country…"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGeocode}
                    disabled={geocodeLoading || !geocodeQuery.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    {geocodeLoading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Search className="h-4 w-4" />
                    }
                    Look up
                  </button>
                </div>
                {geocodeError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> 
                    <div>
                      <strong>{geocodeError}</strong>
                      <p className="mt-1 text-slate-700 opacity-90">
                        Don't worry, you can still register! Just enter your latitude and longitude manually in the coordinate fields below.
                      </p>
                      <a 
                        href="https://support.google.com/maps/answer/18539?hl=en" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-block mt-1 text-indigo-600 hover:text-indigo-800 underline font-semibold"
                      >
                        How to find coordinates on Google Maps ↗
                      </a>
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-400">
                  Tip: For best results include city, state and country — e.g. "12 MG Road, Bengaluru, Karnataka, India"
                </p>
              </div>

              {/* Option B — GPS detect & Manual coordinates */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-4 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    ⚙️ Coordinates & GPS Controls
                  </span>
                  <button
                    type="button"
                    onClick={handleGeolocate}
                    disabled={geoLoading}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-xl border-2 border-indigo-200 text-indigo-700 font-bold text-xs hover:bg-indigo-50 hover:border-indigo-400 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {geoLoading
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Detecting…</>
                      : <><Crosshair className="h-3.5 w-3.5" /> Detect Current GPS</>
                    }
                  </button>
                </div>
                {geoError && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {geoError}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={coords ? coords.lat : ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setCoords(prev => ({
                          lat: isNaN(val) ? 0 : val,
                          lng: prev ? prev.lng : 0,
                        }));
                        setCoordSource('manual');
                        setError('');
                      }}
                      placeholder="e.g. 28.6139"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={coords ? coords.lng : ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setCoords(prev => ({
                          lat: prev ? prev.lat : 0,
                          lng: isNaN(val) ? 0 : val,
                        }));
                        setCoordSource('manual');
                        setError('');
                      }}
                      placeholder="e.g. 77.2090"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Map preview + status */}
              {coords ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-xl">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                    <span>
                      {coordSource === 'gps' ? 'GPS location captured' : coordSource === 'geocode' ? 'Address geocoded' : 'Coordinates set manually'}
                      {' '}<span className="text-green-500 text-xs">({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)})</span>
                    </span>
                  </div>
                  <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <iframe
                      title="Pharmacy Location Map"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-600 font-medium">⚠️ Please set coordinates using one of the methods above before registering.</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !coords}
              id="pharmacy-register-btn"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3.5 px-6 rounded-xl font-bold text-base transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Registering…</>
                : <>Register Pharmacy <ChevronRight className="h-5 w-5" /></>
              }
            </button>

            <p className="text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-700">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PharmacyRegistration;
