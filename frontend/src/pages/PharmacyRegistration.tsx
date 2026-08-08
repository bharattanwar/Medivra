import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MapPin, Phone, Mail, Lock, User, Building2,
  Crosshair, Loader2, ChevronRight, CheckCircle2, AlertCircle
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

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  // Two-phase live GPS/Network location detection
  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    setGeoError('');

    // Attempt 1: High accuracy positioning
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      (err: GeolocationPositionError) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoLoading(false);
          setGeoError(
            'Location permission is blocked. To enable it: 1) Click the tune/padlock icon next to http://localhost in your browser address bar and set Location to "Allow", or 2) Check macOS System Settings -> Privacy & Security -> Location Services.'
          );
        } else {
          // Attempt 2: Standard Wi-Fi / IP fallback positioning
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              setCoords({ lat: fallbackPos.coords.latitude, lng: fallbackPos.coords.longitude });
              setGeoLoading(false);
            },
            () => {
              setGeoLoading(false);
              setGeoError(
                'GPS signal/Wi-Fi positioning unavailable on this device.'
              );
            },
            { timeout: 10000, enableHighAccuracy: false, maximumAge: 300000 }
          );
        }
      },
      { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) {
      setError('Please detect your GPS location before registering.');
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
    <div className="flex-1 py-10 bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-900 flex items-center justify-center p-4 relative">
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
                  Detect your current coordinates using your device's GPS to let patients know how far your pharmacy is.
                </p>
              </div>

              {/* GPS Location Controls */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                      <Crosshair className="h-4 w-4 text-indigo-500" /> GPS Coordinates
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Detect your coordinates using your device's live GPS.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGeolocate}
                    disabled={geoLoading}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all disabled:opacity-60 cursor-pointer shrink-0 shadow-sm"
                  >
                    {geoLoading
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Detecting GPS…</>
                      : <><Crosshair className="h-4 w-4" /> Detect Current GPS</>
                    }
                  </button>
                </div>

                {geoError && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-1.5 leading-relaxed">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" /> {geoError}
                  </p>
                )}

                {/* Editable coordinates for fine-tuning */}
                {coords && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Captured Coordinates (Editable for Fine-tuning)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Latitude
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={coords.lat}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setCoords(prev => ({ lat: isNaN(val) ? 0 : val, lng: prev?.lng ?? 0 }));
                          }}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Longitude
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={coords.lng}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setCoords(prev => ({ lat: prev?.lat ?? 0, lng: isNaN(val) ? 0 : val }));
                          }}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Map preview + status */}
              {coords ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-xl">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                    <span>📍 Location set ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}) — ready to register!</span>
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
                <p className="text-xs text-amber-600 font-medium">⚠️ Please detect your GPS coordinates above before registering.</p>
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
