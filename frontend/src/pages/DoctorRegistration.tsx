import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';

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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '500px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Doctor Profile</h2>
        <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-muted)' }}>
          Complete your medical profile to start consulting.
        </p>
        {error && <div style={{ color: '#ff6b6b', marginBottom: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Specialization</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Cardiologist"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              required
            />
          </div>
          <div className="input-group">
            <label className="input-label">Medical License Number</label>
            <input
              type="text"
              className="input-field"
              value={formData.licenseNumber}
              onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Years of Experience</label>
              <input
                type="number"
                className="input-field"
                value={formData.experienceYears}
                onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                required
              />
            </div>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Consultation Fee ($)</label>
              <input
                type="number"
                className="input-field"
                value={formData.consultationFee}
                onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Hospital Name</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Medivra Central"
              value={formData.hospitalName}
              onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })}
            />
          </div>
          <div className="input-group">
            <label className="input-label">City</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Bangalore"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Profile Image URL</label>
            <input
              type="text"
              className="input-field"
              placeholder="https://example.com/photo.jpg"
              value={formData.profileImageUrl}
              onChange={handleImageUrlChange}
            />
            {formData.profileImageUrl && (
              <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Preview:</p>
                <img 
                  src={formData.profileImageUrl} 
                  alt="Preview" 
                  style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b82f6' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Registering...' : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DoctorRegistration;
