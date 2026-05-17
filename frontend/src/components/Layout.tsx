import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const isDoctor = role === 'DOCTOR';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    navigate('/login');
  };

  const navLinkClass = (path: string) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
      location.pathname === path
        ? 'bg-blue-600 text-white'
        : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
    }`;

  const homePath = token
    ? isDoctor
      ? '/dashboard'
      : '/patient/dashboard'
    : '/login';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
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
                  {isDoctor ? (
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
                  ) : (
                    <>
                      <Link to="/patient/dashboard" className={navLinkClass('/patient/dashboard')}>
                        Find Doctors
                      </Link>
                      <Link to="/patient/appointments" className={navLinkClass('/patient/appointments')}>
                        Appointments
                      </Link>
                      <Link to="/patient/payments" className={navLinkClass('/patient/payments')}>
                        Payments
                      </Link>
                    </>
                  )}
                  <button
                    onClick={handleLogout}
                    className="ml-2 px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
};

export default Layout;
