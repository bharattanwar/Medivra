import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWebSocket } from '../context/WebSocketContext';
import NotificationBell from './NotificationBell';
import PreJoinCallModal, { type PreJoinAppointmentInfo } from './PreJoinCallModal';
import { X, Calendar, CreditCard, FileText, Sparkles, Video, PhoneCall, Menu } from 'lucide-react';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  const [preJoinApt, setPreJoinApt] = useState<PreJoinAppointmentInfo | null>(null);
  const [isPreJoinOpen, setIsPreJoinOpen] = useState(false);

  const handleOpenPreJoin = (apt: PreJoinAppointmentInfo) => {
    setPreJoinApt(apt);
    setIsPreJoinOpen(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    // Signal WebSocketContext to disconnect immediately.
    window.dispatchEvent(new Event('auth:changed'));
    window.location.replace('/login');
  };

  const navLinkClass = (path: string) =>
    `px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${location.pathname === path
      ? 'bg-blue-600 text-white'
      : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
    }`;

  const mobileNavLinkClass = (path: string) =>
    `block px-4 py-2.5 rounded-xl text-base font-semibold transition-colors ${location.pathname === path
      ? 'bg-blue-600 text-white shadow-sm'
      : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
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

  const renderNavLinks = (isMobile = false) => {
    const linkClass = isMobile ? mobileNavLinkClass : navLinkClass;

    if (!token) {
      return (
        <>
          <Link
            to="/login"
            onClick={() => setIsMobileMenuOpen(false)}
            className={isMobile ? mobileNavLinkClass('/login') : `px-4 py-2 rounded-lg text-sm font-semibold transition-all ${location.pathname === '/login' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            Log In
          </Link>
          <Link
            to="/signup"
            onClick={() => setIsMobileMenuOpen(false)}
            className={isMobile ? mobileNavLinkClass('/signup') : `px-4 py-2 rounded-lg text-sm font-semibold transition-all ${location.pathname === '/signup' || location.pathname === '/doctor-registration' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            Sign Up
          </Link>
          <Link
            to="/pharmacy/register"
            onClick={() => setIsMobileMenuOpen(false)}
            className={isMobile ? mobileNavLinkClass('/pharmacy/register') : `px-4 py-2 rounded-lg text-sm font-semibold transition-all ${location.pathname === '/pharmacy/register' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            Pharmacy Partner
          </Link>
        </>
      );
    }

    if (role === 'ADMIN') {
      return (
        <>
          <Link to="/admin/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/admin/dashboard')}>
            Dashboard
          </Link>
          <Link to="/admin/users" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/admin/users')}>
            Users
          </Link>
          <Link to="/admin/doctors" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/admin/doctors')}>
            Doctors Approval
          </Link>
          <Link to="/admin/appointments" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/admin/appointments')}>
            Appointments/Payments
          </Link>
          <Link to="/hospital/emergencies" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/hospital/emergencies')}>
            Emergency Ops
          </Link>
        </>
      );
    }

    if (isPharmacy) {
      return (
        <>
          <Link to="/pharmacy/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/pharmacy/dashboard')}>
            Inventory
          </Link>
        </>
      );
    }

    if (isDoctor) {
      return (
        <>
          <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/dashboard')}>
            Dashboard
          </Link>
          <Link to="/doctor/appointments" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/doctor/appointments')}>
            Appointments
          </Link>
          <Link to="/doctor/availability" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/doctor/availability')}>
            Schedule
          </Link>
        </>
      );
    }

    if (isPatient) {
      return (
        <>
          <Link to="/patient/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/patient/dashboard')}>
            Dashboard
          </Link>
          <Link to="/patient/appointments" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/patient/appointments')}>
            Appointments
          </Link>
          <Link to="/patient/ai/reports" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/patient/ai/reports')}>
            Reports Result
          </Link>
          <Link to="/patient/ai/booking" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/patient/ai/booking')}>
            AI Booking
          </Link>
          <Link to="/patient/pharmacy" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/patient/pharmacy')}>
            Order Medicines
          </Link>
          <Link to="/patient/payments" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/patient/payments')}>
            Payments
          </Link>
          <Link
            to="/patient/emergency"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${location.pathname === '/patient/emergency'
                ? 'bg-red-600 text-white shadow-lg shadow-red-500/30'
                : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200'
              }`}
          >
            🚨 SOS
          </Link>
        </>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 relative">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to={homePath} className="flex items-center gap-2 shrink-0">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg">
                M
              </span>
              <span className="text-xl font-bold text-slate-900">
                Medi<span className="text-blue-600">vra</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
              {renderNavLinks(false)}

              {token && (
                <>
                  <div className="ml-2 mr-1">
                    <NotificationBell onOpenPreJoin={handleOpenPreJoin} />
                  </div>
                  <button
                    onClick={handleLogout}
                    className="ml-2 px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors cursor-pointer"
                  >
                    Logout
                  </button>
                </>
              )}
            </nav>

            {/* Mobile Header Controls */}
            <div className="flex lg:hidden items-center gap-2">
              {token && (
                <div className="mr-1">
                  <NotificationBell onOpenPreJoin={handleOpenPreJoin} />
                </div>
              )}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Toggle Navigation Menu"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Slide-Down Menu Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-100 bg-white shadow-xl px-4 pt-3 pb-6 space-y-2 animate-in slide-in-from-top-2">
            <div className="flex flex-col space-y-1.5">
              {renderNavLinks(true)}
            </div>

            {token && (
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Role: <span className="text-blue-600">{role || 'USER'}</span>
                </span>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                >
                  Logout Account
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col">{children}</main>

      {/* Global Pre-Join Call Re-Check Confirmation Modal */}
      <PreJoinCallModal
        isOpen={isPreJoinOpen}
        onClose={() => setIsPreJoinOpen(false)}
        appointment={preJoinApt}
      />

      {/* Real-Time Toast Popup Container */}
      <div className="fixed top-20 right-4 sm:right-6 left-4 sm:left-auto z-50 flex flex-col gap-3 pointer-events-none w-auto sm:w-88 max-w-[calc(100vw-2rem)]">
        {toasts.map((toast) => {
          const isCallWaiting = toast.type === 'CALL_WAITING';

          const getToastIcon = (type: string) => {
            switch (type) {
              case 'CALL_WAITING':
                return <Video className="w-5 h-5 text-blue-600 animate-pulse" />;
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
              case 'CALL_WAITING':
                return 'bg-gradient-to-r from-blue-50/98 to-indigo-50/98 border-blue-300 shadow-blue-500/20 ring-1 ring-blue-400/30';
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
              className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border flex flex-col space-y-2.5 w-full bg-white/95 backdrop-blur-md transform transition-all duration-300 animate-in slide-in-from-right-10 ${getToastBg(
                toast.type
              )}`}
            >
              <div className="flex items-start space-x-3 w-full">
                <div className="shrink-0 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                  {getToastIcon(toast.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-bold uppercase tracking-wider ${isCallWaiting ? 'text-blue-700' : 'text-slate-800'}`}>
                      {toast.title}
                    </p>
                    {isCallWaiting && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                        LIVE
                      </span>
                    )}
                  </div>
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

              {/* Action Button for CALL_WAITING */}
              {isCallWaiting && (
                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (toast.relatedEntityId) {
                        handleOpenPreJoin({
                          id: toast.relatedEntityId,
                          callerName: toast.title.includes('Doctor') ? 'Doctor' : 'Patient',
                          isWaiting: true
                        });
                      }
                      removeToast(toast.id);
                    }}
                    className="w-full py-2 px-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    Review & Join Consultation
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Layout;
