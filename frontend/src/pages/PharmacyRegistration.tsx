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

// ── Geocode an address string using OSM Nominatim (free, no API key) ──────────
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
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
  const [coordSource, setCoordSource] = useState<'gps' | 'geocode' | null>(null);

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
      setError('Please set your pharmacy location before registering.');
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

  // Shared "location confirmed" badge
  const LocationBadge = () => (
    <div className="flex items-center gap-2 mt-3 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-xl">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
      <span>
        {coordSource === 'gps' ? 'GPS location captured' : 'Address geocoded successfully'}
        {' '}<span className="text-green-500 text-xs">— coordinates stored securely</span>
      </span>
      <button
        type="button"
        onClick={() => { setCoords(null); setCoordSource(null); }}
        className="ml-auto text-xs text-green-600 hover:text-green-800 underline"
      >
        Change
      </button>
    </div>
  );

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
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                Set Pharmacy Location
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                We store your coordinates to help patients measure distance. Choose either method below.
              </p>

              {coords ? (
                <LocationBadge />
              ) : (
                <div className="space-y-3">
                  {/* Option A — Geocode from address */}
                  <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-indigo-500" /> Locate by Address
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
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
                      >
                        {geocodeLoading
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Search className="h-4 w-4" />
                        }
                        Look up
                      </button>
                    </div>
                    {geocodeError && (
                      <p className="text-xs text-red-600 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {geocodeError}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">
                      Tip: For best results include city, state and country — e.g. "12 MG Road, Bengaluru, Karnataka, India"
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 border-t border-slate-200" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">or</span>
                    <div className="flex-1 border-t border-slate-200" />
                  </div>

                  {/* Option B — GPS detect */}
                  <button
                    type="button"
                    onClick={handleGeolocate}
                    disabled={geoLoading}
                    className="w-full flex items-center justify-center gap-3 py-3 px-5 rounded-2xl border-2 border-indigo-200 text-indigo-700 font-semibold text-sm hover:bg-indigo-50 hover:border-indigo-400 transition-all disabled:opacity-60"
                  >
                    {geoLoading
                      ? <><Loader2 className="h-5 w-5 animate-spin" /> Detecting GPS location…</>
                      : <><Crosshair className="h-5 w-5" /> Use My Current GPS Location</>
                    }
                  </button>
                  {geoError && (
                    <p className="text-xs text-red-600 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {geoError}
                    </p>
                  )}
                </div>
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
