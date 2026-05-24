import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Search, DollarSign, Activity, FileText, ArrowLeft, ArrowUpRight } from 'lucide-react';
import api from '../services/api';

interface Appointment {
  id: string;
  patientName: string;
  patientEmail: string;
  doctorName: string;
  doctorEmail: string;
  date: string;
  slot: string;
  status: string;
  amount: number;
  paymentStatus: string;
}

const AdminAppointments: React.FC = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    if (!token || role !== 'ADMIN') {
      navigate('/login');
      return;
    }
    fetchAppointments();
  }, [token, role, navigate]);

  useEffect(() => {
    let result = appointments;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.patientName.toLowerCase().includes(term) ||
          a.doctorName.toLowerCase().includes(term) ||
          a.patientEmail.toLowerCase().includes(term) ||
          a.doctorEmail.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((a) => a.status === statusFilter);
    }

    if (paymentFilter !== 'ALL') {
      result = result.filter((a) => a.paymentStatus === paymentFilter);
    }

    setFilteredAppointments(result);
  }, [searchTerm, statusFilter, paymentFilter, appointments]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/admin/appointments');
      if (response.data.success) {
        setAppointments(response.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching appointments:', err);
      setError('Failed to fetch platform appointments ledger.');
    } finally {
      setLoading(false);
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
              <Calendar className="text-blue-600 h-8 w-8" />
              Monitor Appointments & Payments
            </h1>
            <p className="text-slate-500 mt-1">Audit platform consultation cycles, Razorpay invoicing status, and payments logs.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-center font-medium shadow-sm">
            {error}
          </div>
        )}

        {/* Filter Controls */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by doctor name/email or patient name/email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            {/* Status Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Consult Status:</span>
              {['ALL', 'PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Payment Status Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Payment Status:</span>
              {['ALL', 'UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'].map((payStatus) => (
                <button
                  key={payStatus}
                  onClick={() => setPaymentFilter(payStatus)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    paymentFilter === payStatus
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650'
                  }`}
                >
                  {payStatus}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabular List */}
        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredAppointments.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Patient Details</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Doctor Details</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date & Slot</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Consult Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Total Amount</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAppointments.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-sm">
                      {/* Patient Details */}
                      <td className="px-6 py-4.5">
                        <span className="font-bold text-slate-850 block">{item.patientName}</span>
                        <span className="text-xs text-slate-400 font-semibold mt-0.5 block">{item.patientEmail}</span>
                      </td>

                      {/* Doctor Details */}
                      <td className="px-6 py-4.5">
                        <span className="font-bold text-slate-800 block">Dr. {item.doctorName}</span>
                        <span className="text-xs text-slate-400 font-semibold mt-0.5 block">{item.doctorEmail}</span>
                      </td>

                      {/* Date & Slot */}
                      <td className="px-6 py-4.5">
                        <span className="font-bold text-slate-700 block">{item.date}</span>
                        <span className="text-xs text-slate-400 font-bold uppercase mt-0.5 block">{item.slot}</span>
                      </td>

                      {/* Consultation Status */}
                      <td className="px-6 py-4.5">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                            item.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-700'
                              : item.status === 'CONFIRMED'
                              ? 'bg-blue-100 text-blue-700'
                              : item.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="px-6 py-4.5 font-extrabold text-slate-850">
                        ₹{item.amount.toFixed(2)}
                      </td>

                      {/* Payment Status */}
                      <td className="px-6 py-4.5 text-right">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border shadow-sm ${
                            item.paymentStatus === 'PAID'
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : item.paymentStatus === 'UNPAID' || item.paymentStatus === 'FAILED'
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : 'bg-amber-50 border-amber-200 text-amber-700'
                          }`}
                        >
                          {item.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>Showing {filteredAppointments.length} total entries</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-350">
            <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No consult records found</h3>
            <p className="text-slate-500 mb-6">No appointments match your filters or selected terms.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setPaymentFilter('ALL');
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

export default AdminAppointments;
