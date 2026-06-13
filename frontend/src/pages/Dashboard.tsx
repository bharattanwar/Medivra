import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Users,
  FileText,
  ChevronRight,
  Stethoscope,
  XCircle,
} from 'lucide-react';
import api from '../services/api';

interface Appointment {
  id: string;
  patientName: string;
  appointmentDate: string;
  timeSlot: string;
  status: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (role !== 'DOCTOR') {
      navigate('/patient/dashboard');
      return;
    }
    fetchAppointments();
  }, [token, role, navigate]);

  const fetchAppointments = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) return;
      const response = await api.get(`/appointments/doctor/userId/${userId}`);
      setAppointments(response.data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!token || role !== 'DOCTOR') return null;

  const confirmed = appointments.filter((a) => a.status === 'CONFIRMED');
  const pending = appointments.filter((a) => a.status === 'PENDING');
  const cancelled = appointments.filter((a) => a.status === 'CANCELLED' || a.status === 'REJECTED');
  const upcoming = confirmed
    .filter((a) => new Date(a.appointmentDate) >= new Date(new Date().toDateString()))
    .slice(0, 5);

  const statCards = [
    {
      label: 'Total Appointments',
      value: appointments.length,
      icon: Calendar,
      color: 'bg-blue-600',
      light: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Confirmed',
      value: confirmed.length,
      icon: Users,
      color: 'bg-green-600',
      light: 'bg-green-50 text-green-700',
    },
    {
      label: 'Awaiting Payment',
      value: pending.length,
      icon: Clock,
      color: 'bg-amber-500',
      light: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Cancelled / Rejected',
      value: cancelled.length,
      icon: XCircle,
      color: 'bg-red-600',
      light: 'bg-red-50 text-red-700',
    },
  ];

  return (
    <div className="min-h-full bg-slate-50">
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-2">
            <Stethoscope className="h-8 w-8 text-blue-200" />
            <span className="text-blue-200 font-medium text-sm uppercase tracking-wide">
              Doctor Portal
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Welcome back, Doctor</h1>
          <p className="text-blue-100 max-w-xl">
            Manage your schedule, view patient appointments, and upload prescriptions from one place.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(({ label, value, icon: Icon, color, light }) => (
            <div
              key={label}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center gap-4"
            >
              <div className={`p-3 rounded-xl ${light}`}>
                <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">{label}</p>
                <p className="text-3xl font-bold text-slate-900">{loading ? '—' : value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Upcoming Consultations</h2>
              <Link
                to="/doctor/appointments"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : upcoming.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {upcoming.map((apt) => (
                  <li key={apt.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <p className="font-semibold text-slate-900">{apt.patientName}</p>
                      <p className="text-sm text-slate-500">
                        {new Date(apt.appointmentDate).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        · {apt.timeSlot}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                      {apt.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-16 px-6">
                <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No upcoming appointments</p>
                <p className="text-sm text-slate-400 mt-1">
                  Confirmed bookings will appear here.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Link
              to="/doctor/appointments"
              className="block bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Appointments</p>
                  <p className="text-sm text-slate-500">View & manage patients</p>
                </div>
              </div>
            </Link>

            <Link
              to="/doctor/availability"
              className="block bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:border-green-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Manage Schedule</p>
                  <p className="text-sm text-slate-500">Set your availability</p>
                </div>
              </div>
            </Link>

            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl border border-green-200 p-6">
              <FileText className="h-8 w-8 text-green-600 mb-3" />
              <p className="font-bold text-slate-900 mb-1">Prescriptions</p>
              <p className="text-sm text-slate-600 mb-4">
                Upload prescriptions after consultations from the appointments page.
              </p>
              <Link
                to="/doctor/appointments"
                className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-800"
              >
                Go to appointments <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
