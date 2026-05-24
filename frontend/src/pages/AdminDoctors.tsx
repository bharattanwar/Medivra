import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, CheckCircle, Clock, ShieldAlert, Award, FileText, ArrowLeft, Search } from 'lucide-react';
import api from '../services/api';

interface Doctor {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  specialization: string;
  licenseNumber: string;
  experienceYears: number;
  consultationFee: number;
  hospitalName?: string;
  city?: string;
  isApproved: boolean;
  rating: number;
}

const AdminDoctors: React.FC = () => {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING, APPROVED
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    if (!token || role !== 'ADMIN') {
      navigate('/login');
      return;
    }
    fetchDoctors();
  }, [token, role, navigate]);

  useEffect(() => {
    let result = doctors;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.fullName.toLowerCase().includes(term) ||
          d.specialization.toLowerCase().includes(term) ||
          d.licenseNumber.toLowerCase().includes(term)
      );
    }

    if (statusFilter === 'PENDING') {
      result = result.filter((d) => !d.isApproved);
    } else if (statusFilter === 'APPROVED') {
      result = result.filter((d) => d.isApproved);
    }

    setFilteredDoctors(result);
  }, [searchTerm, statusFilter, doctors]);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/admin/doctors');
      if (response.data.success) {
        setDoctors(response.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching doctors:', err);
      setError('Failed to fetch doctor directory details.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApprove = async (doctorId: string, currentApproved: boolean) => {
    try {
      setActionLoadingId(doctorId);
      setError('');
      setSuccessMsg('');

      const response = await api.put(`/admin/doctors/${doctorId}/approve`);
      if (response.data.success) {
        setSuccessMsg(response.data.message || 'Action completed successfully');
        
        // Update local state
        setDoctors((prev) =>
          prev.map((d) => (d.id === doctorId ? { ...d, isApproved: !currentApproved } : d))
        );

        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      console.error('Error verifying doctor:', err);
      setError('Failed to modify doctor verification state.');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!token || role !== 'ADMIN') return null;

  return (
    <div className="min-h-full bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Back and Title */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors text-sm font-semibold mb-3 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <Award className="text-blue-600 h-8 w-8 animate-pulse" />
              Approve Doctor Profiles
            </h1>
            <p className="text-slate-500 mt-1">Audit clinical licensing, specialities, fees and grant verified badges.</p>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-center font-medium shadow-sm flex items-center justify-center gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 p-4 rounded-2xl text-center font-medium shadow-sm flex items-center justify-center gap-2">
            <span className="text-xl">✓</span>
            {successMsg}
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm mb-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by doctor name, specialization, or license..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div className="flex gap-2">
            {[
              { label: 'All Doctors', filter: 'ALL' },
              { label: 'Pending Verification', filter: 'PENDING' },
              { label: 'Verified Profiles', filter: 'APPROVED' },
            ].map((status) => (
              <button
                key={status.filter}
                onClick={() => setStatusFilter(status.filter)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  statusFilter === status.filter
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-600'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Listing Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredDoctors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredDoctors.map((doctor) => (
              <div
                key={doctor.id}
                className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all duration-300 relative group"
              >
                {/* Header & Badges */}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4 gap-2">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 leading-tight">{doctor.fullName}</h3>
                      <p className="text-slate-400 font-semibold text-sm mt-0.5">{doctor.specialization}</p>
                    </div>
                    {doctor.isApproved ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-50 border border-green-200 text-green-700 shadow-sm shrink-0">
                        <CheckCircle className="h-4 w-4" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 shadow-sm shrink-0 animate-pulse">
                        <Clock className="h-4 w-4" /> Pending Approval
                      </span>
                    )}
                  </div>

                  {/* Doctor Info Elements */}
                  <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-slate-400" /> License Number
                      </span>
                      <span className="font-bold text-slate-800 font-mono bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                        {doctor.licenseNumber}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                        <Award className="h-4 w-4 text-slate-400" /> Experience
                      </span>
                      <span className="font-bold text-slate-700">{doctor.experienceYears} Years Practicing</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 font-semibold">Consultation Fee</span>
                      <span className="font-extrabold text-blue-600">₹{doctor.consultationFee.toFixed(2)}</span>
                    </div>

                    {(doctor.hospitalName || doctor.city) && (
                      <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-2.5 mt-1">
                        <span className="text-slate-400 font-semibold">Location / Clinic</span>
                        <span className="font-bold text-slate-650 truncate max-w-[200px]">
                          {doctor.hospitalName || 'Clinic'}{doctor.city ? `, ${doctor.city}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer and Approve Button */}
                <div className="bg-slate-50 border-t border-slate-100 p-5 flex items-center justify-between gap-4">
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    Rating: <span className="text-amber-500 font-extrabold">{doctor.rating > 0 ? `${doctor.rating}★` : 'New'}</span>
                  </div>

                  <button
                    onClick={() => handleToggleApprove(doctor.id, doctor.isApproved)}
                    disabled={actionLoadingId === doctor.id}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 inline-flex items-center gap-2 border cursor-pointer ${
                      doctor.isApproved
                        ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800'
                        : 'bg-green-600 border-green-700 text-white hover:bg-green-700'
                    } disabled:opacity-50`}
                  >
                    {actionLoadingId === doctor.id ? (
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : doctor.isApproved ? (
                      'Mark Pending'
                    ) : (
                      'Approve Doctor'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-350">
            <Stethoscope className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No doctor accounts match criteria</h3>
            <p className="text-slate-500 mb-6">Try tweaking your search phrase or filters.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
              className="text-blue-600 font-bold hover:text-blue-700 text-sm cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDoctors;
