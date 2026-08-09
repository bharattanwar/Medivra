import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWebSocket } from '../context/WebSocketContext';
import NotificationBell from './NotificationBell';
import { X, Calendar, CreditCard, FileText, Sparkles } from 'lucide-react';

/** Returns true if a JWT token string is expired (or unparseable). */
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp is in seconds
    return payload.exp * 1000 < Date.now();
  } catch {
    return true; // treat malformed tokens as expired
  }
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  // Auth pages should NEVER show the authenticated navbar, regardless of localStorage state
  const AUTH_PAGES = ['/login', '/signup', '/doctor-registration', '/pharmacy/register'];
  const isAuthPage = AUTH_PAGES.includes(location.pathname);

  // Validate token: clear stale/expired tokens immediately
  const rawToken = localStorage.getItem('token');
  if (rawToken && isTokenExpired(rawToken)) {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
  }

  // Re-read after potential cleanup
  const token = isAuthPage ? null : localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const isDoctor = role === 'DOCTOR';
  const isPharmacy = role === 'PHARMACY';
  const isPatient = role === 'PATIENT';

  const { toasts, removeToast } = useWebSocket();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    window.location.replace('/login');
  };

  const navLinkClass = (path: string) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${location.pathname === path
      ? 'bg-blue-600 text-white'
      : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
    }`;

  const homePath = token
    ? role === 'ADMIN'
      ? '/admin/dashboard'
      : isDoctor
        ? '/dashboard'
        : isPharmacy
          ? '/pharmacy/dashboard'
          : '/patient/dashboard'
    : '/login';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 relative">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to={homePath} className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg">
                M
              </span>
              <span className="text-xl font-bold text-slate-900">
                Medi<span className="text-blue-600">vra</span>
              </span>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-2">
              {token ? (
                <>
                  {role === 'ADMIN' ? (
                    <>
                      <Link to="/admin/dashboard" className={navLinkClass('/admin/dashboard')}>
                        Dashboard
                      </Link>
                      <Link to="/admin/users" className={navLinkClass('/admin/users')}>
                        Users
                      </Link>
                      <Link to="/admin/doctors" className={navLinkClass('/admin/doctors')}>
                        Doctors Approval
                      </Link>
                      <Link to="/admin/appointments" className={navLinkClass('/admin/appointments')}>
                        Appointments/Payments
                      </Link>
                      <Link to="/hospital/emergencies" className={navLinkClass('/hospital/emergencies')}>
                        Emergency Ops
                      </Link>
                    </>
                  ) : isPharmacy ? (
                    <>
                      <Link to="/pharmacy/dashboard" className={navLinkClass('/pharmacy/dashboard')}>
                        Inventory
                      </Link>
                    </>
                  ) : isDoctor ? (
                    <>
                      <Link to="/dashboard" className={navLinkClass('/dashboard')}>
                        Dashboard
                      </Link>
                      <Link to="/doctor/appointments" className={navLinkClass('/doctor/appointments')}>
                        Appointments
                      </Link>
                      <Link to="/doctor/availability" className={navLinkClass('/doctor/availability')}>
                        Schedule
                      </Link>
                    </>
                  ) : isPatient ? (
                    <>
                      <Link to="/patient/dashboard" className={navLinkClass('/patient/dashboard')}>
                        Dashboard
                      </Link>
                      <Link to="/patient/appointments" className={navLinkClass('/patient/appointments')}>
                        Appointments History
                      </Link>
                      <Link to="/patient/ai/reports" className={navLinkClass('/patient/ai/reports')}>
                        Reports Result
                      </Link>
                      <Link to="/patient/ai/booking" className={navLinkClass('/patient/ai/booking')}>
                        AI Booking
                      </Link>
                      <Link to="/patient/pharmacy" className={navLinkClass('/patient/pharmacy')}>
                        Order Medicines
                      </Link>
                      <Link to="/patient/payments" className={navLinkClass('/patient/payments')}>
                        Payments
                      </Link>
                      <Link
                        to="/patient/emergency"
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${location.pathname === '/patient/emergency'
                            ? 'bg-red-600 text-white shadow-lg shadow-red-500/30'
                            : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200'
                          }`}
                      >
                        🚨 SOS
                      </Link>
                    </>
                  ) : null}

                  {/* Real-time Notification Bell Center */}
                  <div className="ml-2 mr-1">
                    <NotificationBell />
                  </div>

                  <button
                    onClick={handleLogout}
                    className="ml-2 px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors cursor-pointer"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${location.pathname === '/login'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${location.pathname === '/signup' || location.pathname === '/doctor-registration'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                  >
                    Sign Up
                  </Link>
                  <Link
                    to="/pharmacy/register"
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${location.pathname === '/pharmacy/register'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                  >
                    Pharmacy Partner
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>

      {/* Real-Time Toast Popup Container */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-3 pointer-events-none w-80 max-w-[90vw]">
        {toasts.map((toast) => {
          const getToastIcon = (type: string) => {
            switch (type) {
              case 'APPOINTMENT_BOOKED':
              case 'APPOINTMENT_CONFIRMED':
                return <Calendar className="w-5 h-5 text-blue-600" />;
              case 'PAYMENT_SUCCESS':
                return <CreditCard className="w-5 h-5 text-green-600" />;
              case 'PRESCRIPTION_UPLOADED':
                return <FileText className="w-5 h-5 text-purple-600" />;
              default:
                return <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />;
            }
          };

          const getToastBg = (type: string) => {
            switch (type) {
              case 'APPOINTMENT_BOOKED':
              case 'APPOINTMENT_CONFIRMED':
                return 'bg-blue-50/95 border-blue-100';
              case 'PAYMENT_SUCCESS':
                return 'bg-green-50/95 border-green-100';
              case 'PRESCRIPTION_UPLOADED':
                return 'bg-purple-50/95 border-purple-100';
              default:
                return 'bg-amber-50/95 border-amber-100';
            }
          };

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border flex items-start space-x-3 w-full bg-white/95 backdrop-blur-md transform transition-all duration-300 animate-in slide-in-from-right-10 ${getToastBg(
                toast.type
              )}`}
            >
              <div className="shrink-0 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                {getToastIcon(toast.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {toast.title}
                </p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Layout;
