import React from 'react';
import { MapPin, Building2, Star, Calendar } from 'lucide-react';

interface DoctorProps {
  doctor: {
    id: string;
    fullName: string;
    specialization: string;
    experienceYears: number;
    consultationFee: number;
    hospitalName?: string;
    city?: string;
    rating?: number;
    profileImageUrl?: string;
    isAvailable?: boolean;
    availableInClinic?: boolean;
    availableVideo?: boolean;
  };
  onBookNow?: (doctor: DoctorProps['doctor']) => void;
}

const DoctorCard: React.FC<DoctorProps> = ({ doctor, onBookNow }) => {
  const avatarUrl =
    doctor.profileImageUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.fullName)}&background=2563eb&color=fff&size=200`;

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-300 overflow-hidden flex flex-col h-full group">
      <div className="relative h-44 bg-gradient-to-br from-blue-50 to-slate-100 overflow-hidden">
        <img
          src={avatarUrl}
          alt={doctor.fullName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.fullName)}&background=2563eb&color=fff&size=200`;
          }}
        />
        {doctor.isAvailable !== false && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Available
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start gap-2 mb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              Dr. {doctor.fullName}
            </h3>
            <p className="text-blue-600 font-semibold text-sm">{doctor.specialization}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {doctor.availableVideo !== false && (
                <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded-md font-bold border border-sky-100 flex items-center gap-0.5">
                  🌐 Video
                </span>
              )}
              {doctor.availableInClinic !== false && (
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold border border-indigo-100 flex items-center gap-0.5">
                  🏥 In-Clinic
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg shrink-0">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span className="text-sm font-bold text-amber-800">{doctor.rating ?? '4.5'}</span>
          </div>
        </div>

        <ul className="space-y-2 mb-5 text-sm text-slate-600">
          <li className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500 shrink-0" />
            <span>{doctor.experienceYears} years experience</span>
          </li>
          <li className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
            <span className="truncate">{doctor.hospitalName || 'Medivra Hospital'}</span>
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
            <span>{doctor.city || 'India'}</span>
          </li>
        </ul>

        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Fee</p>
            <p className="text-xl font-bold text-slate-900">₹{doctor.consultationFee}</p>
          </div>
          <button
            type="button"
            onClick={() => onBookNow?.(doctor)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm hover:shadow-md"
          >
            Book Now
          </button>
        </div>
      </div>
    </article>
  );
};

export default DoctorCard;
