import { Link } from 'react-router-dom';
import { HeartPulse, Shield, Calendar } from 'lucide-react';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

const AuthShell = ({ title, subtitle, children, footer }: AuthShellProps) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-[700px] lg:shrink-0 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white p-8 xl:p-10 flex-col justify-between">
        <div>
          <Link to="/login" className="inline-flex items-center gap-2 mb-10">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 font-bold text-lg">
              M
            </span>
            <span className="text-xl font-bold">Medivra</span>
          </Link>
          <h2 className="text-2xl font-bold leading-snug mb-3">
            Healthcare made simple for patients & doctors
          </h2>
          <p className="text-blue-100 text-base leading-relaxed">
            Book consultations, pay securely, and manage appointments — all in one place.
          </p>
        </div>
        <ul className="space-y-3 text-sm">
          {[
            { icon: Calendar, text: 'Easy online appointment booking' },
            { icon: Shield, text: 'Secure Razorpay payments' },
            { icon: HeartPulse, text: 'Trusted by medical professionals' },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-blue-100">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <Icon className="h-5 w-5" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-slate-50">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden text-center mb-8">
            <Link to="/login" className="inline-flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg">
                M
              </span>
              <span className="text-xl font-bold text-slate-900">
                Medi<span className="text-blue-600">vra</span>
              </span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
              <p className="text-slate-500 mt-2 text-sm">{subtitle}</p>
            </div>
            {children}
          </div>
          <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
