import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Briefcase, CreditCard, Award, FileText, Image, MapPin, Landmark } from 'lucide-react';
import api from '../services/api';
import AuthShell from '../components/AuthShell';

const DoctorRegistration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userInfo = location.state as { fullName: string; email: string; password: string } | null;

  const [formData, setFormData] = useState({
    specialization: '',
    licenseNumber: '',
    experienceYears: '',
    consultationFee: '',
    hospitalName: '',
    city: '',
    profileImageUrl: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const cleanImageUrl = (url: string) => {
    if (!url) return url;
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('google.') && urlObj.pathname === '/imgres') {
        const imgUrl = urlObj.searchParams.get('imgurl');
        if (imgUrl) return decodeURIComponent(imgUrl);
      }
    } catch (e) {
      // Not a valid URL
    }
    return url;
  };

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanedUrl = cleanImageUrl(e.target.value);
    setFormData({ ...formData, profileImageUrl: cleanedUrl });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!userInfo) {
      setError('User information is missing. Please go back to signup.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        fullName: userInfo.fullName,
        email: userInfo.email,
        password: userInfo.password,
        specialization: formData.specialization,
        licenseNumber: formData.licenseNumber,
        experienceYears: parseInt(formData.experienceYears),
        consultationFee: parseFloat(formData.consultationFee),
        hospitalName: formData.hospitalName,
        city: formData.city,
        profileImageUrl: formData.profileImageUrl,
      };

      const response = await api.post('/doctors/register', payload);
      const { token, role, userId } = response.data.data;
      localStorage.setItem('token', token);
      localStorage.setItem('role', role);
      if (userId) {
        localStorage.setItem('userId', userId);
      }
      navigate('/dashboard');
    } catch (err: any) {
      const message = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Doctor Profile"
      subtitle="Complete your medical profile to start consulting"
      footer={
        <Link to="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
          ← Back to Signup
        </Link>
      }
    >
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Specialization */}
        <div>
          <label htmlFor="specialization" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Specialization
          </label>
          <div className="relative">
            <Award className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              id="specialization"
              type="text"
              required
              placeholder="e.g. Cardiologist"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
            />
          </div>
        </div>

        {/* License Number */}
        <div>
          <label htmlFor="licenseNumber" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Medical License Number
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              id="licenseNumber"
              type="text"
              required
              placeholder="e.g. LIC-12345678"
              value={formData.licenseNumber}
              onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
            />
          </div>
        </div>

        {/* Experience & Fee */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="experienceYears" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Experience (Years)
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                id="experienceYears"
                type="number"
                required
                min="0"
                placeholder="5"
                value={formData.experienceYears}
                onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="consultationFee" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Consultation Fee (₹)
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                id="consultationFee"
                type="number"
                required
                min="0"
                placeholder="500"
                value={formData.consultationFee}
                onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
              />
            </div>
          </div>
        </div>

        {/* Hospital Name */}
        <div>
          <label htmlFor="hospitalName" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Hospital Name
          </label>
          <div className="relative">
            <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              id="hospitalName"
              type="text"
              placeholder="e.g. Medivra Central"
              value={formData.hospitalName}
              onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
            />
          </div>
        </div>

        {/* City */}
        <div>
          <label htmlFor="city" className="block text-sm font-semibold text-slate-700 mb-1.5">
            City
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              id="city"
              type="text"
              placeholder="e.g. Bangalore"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
            />
          </div>
        </div>

        {/* Profile Image URL */}
        <div>
          <label htmlFor="profileImageUrl" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Profile Image URL
          </label>
          <div className="relative">
            <Image className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              id="profileImageUrl"
              type="text"
              placeholder="https://example.com/photo.jpg"
              value={formData.profileImageUrl}
              onChange={handleImageUrlChange}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
            />
          </div>
          {formData.profileImageUrl && (
            <div className="mt-3 flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Preview:</span>
              <img
                src={formData.profileImageUrl}
                alt="Preview"
                className="w-12 h-12 rounded-full object-cover border-2 border-green-500 shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-all shadow-md active:scale-95 text-sm mt-6"
        >
          {loading ? 'Completing Registration...' : 'Complete Registration'}
        </button>
      </form>
    </AuthShell>
  );
};

export default DoctorRegistration;
