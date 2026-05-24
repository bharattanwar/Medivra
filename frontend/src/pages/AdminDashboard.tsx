import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Stethoscope, Calendar, DollarSign, ArrowUpRight, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import api from '../services/api';

interface Analytics {
  totalPatients: number;
  totalDoctors: number;
  pendingDoctors: number;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  totalRevenue: number;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    if (!token || role !== 'ADMIN') {
      navigate('/login');
      return;
    }
    fetchAnalytics();
  }, [token, role, navigate]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/admin/analytics');
      if (response.data.success) {
        setAnalytics(response.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError('Failed to fetch analytics statistics.');
    } finally {
      setLoading(false);
    }
  };

  if (!token || role !== 'ADMIN') return null;

  const cards = [
    {
      title: 'Total Patients',
      value: analytics?.totalPatients ?? 0,
      icon: Users,
      color: 'from-blue-500 to-indigo-600',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Registered Doctors',
      value: analytics?.totalDoctors ?? 0,
      icon: Stethoscope,
      color: 'from-emerald-400 to-teal-600',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Pending Approvals',
      value: analytics?.pendingDoctors ?? 0,
      icon: Clock,
      color: 'from-amber-400 to-orange-500',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      alert: (analytics?.pendingDoctors ?? 0) > 0,
    },
    {
      title: 'Total Appointments',
      value: analytics?.totalAppointments ?? 0,
      icon: Calendar,
      color: 'from-purple-500 to-pink-600',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="min-h-full bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Dashboard</h1>
            <p className="text-slate-500 mt-1">Monitor users, verify doctors, and keep track of system-wide health.</p>
          </div>
          <button
            onClick={fetchAnalytics}
            className="self-start md:self-auto flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
          >
            Refresh Data
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-center font-medium shadow-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {cards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <div
                    key={idx}
                    className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">{card.title}</span>
                      <div className={`p-3 rounded-2xl ${card.bgColor} ${card.textColor} group-hover:scale-110 transition-transform`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                        {card.value}
                      </span>
                      {card.alert && (
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full animate-pulse">
                          Requires verification
                        </span>
                      )}
                    </div>
                    {/* Visual Bottom bar decoration */}
                    <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r ${card.color}`} />
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Financial Performance Panel */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm lg:col-span-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Total System Revenue</h3>
                      <p className="text-sm text-slate-400">Total earnings from paid consultations system-wide.</p>
                    </div>
                    <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
                      <DollarSign className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="mb-8">
                    <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Gross Collected Revenue
                    </span>
                    <div className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight flex items-baseline">
                      ₹{(analytics?.totalRevenue ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      <span className="text-sm font-bold text-green-600 ml-3 flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" /> Live Platform Volume
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="space-y-4">
                  <div className="border-t border-slate-100 pt-4">
                    <div className="flex justify-between text-sm font-bold text-slate-700 mb-1.5">
                      <span>Appointment Completion Success Rate</span>
                      <span>
                        {analytics?.totalAppointments
                          ? Math.round((analytics.completedAppointments / analytics.totalAppointments) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-1000"
                        style={{
                          width: `${
                            analytics?.totalAppointments
                              ? (analytics.completedAppointments / analytics.totalAppointments) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-slate-400 font-semibold pt-1">
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-500 block" /> Completed:{' '}
                      {analytics?.completedAppointments ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400 block" /> Cancelled:{' '}
                      {analytics?.cancelledAppointments ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400 block" /> Active / Pending:{' '}
                      {(analytics?.totalAppointments ?? 0) -
                        ((analytics?.completedAppointments ?? 0) + (analytics?.cancelledAppointments ?? 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Admin Actions */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Management Actions</h3>
                  <p className="text-slate-400 text-sm mb-6">
                    Easily jump directly to critical verification screens and accounts moderation.
                  </p>

                  <div className="space-y-3">
                    <button
                      onClick={() => navigate('/admin/doctors')}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-100 text-slate-700 hover:text-blue-700 rounded-2xl text-left font-bold transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-500 group-hover:text-blue-600">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm">Pending Verification</p>
                          <p className="text-xs font-medium text-slate-400 mt-0.5">
                            Approve credentials of newly signed doctors
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>

                    <button
                      onClick={() => navigate('/admin/users')}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-100 text-slate-700 hover:text-blue-700 rounded-2xl text-left font-bold transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-500 group-hover:text-blue-600">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm">Manage User Accounts</p>
                          <p className="text-xs font-medium text-slate-400 mt-0.5">
                            Block or unblock patients/doctors accounts
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>

                    <button
                      onClick={() => navigate('/admin/appointments')}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-100 text-slate-700 hover:text-blue-700 rounded-2xl text-left font-bold transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-500 group-hover:text-blue-600">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm">Platform Audit Ledger</p>
                          <p className="text-xs font-medium text-slate-400 mt-0.5">
                            Monitor bookings status and Razorpay invoices
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </div>

                <div className="mt-8 border-t border-slate-100 pt-4 flex justify-between text-xs font-bold text-slate-400">
                  <span>Platform: Medivra v1.2</span>
                  <span>Environment: Production</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
