import React, { useState, useEffect } from 'react';
import { Search, MapPin, Stethoscope, User } from 'lucide-react';
import api from '../services/api';
import DoctorCard from '../components/DoctorCard';
import BookingModal from '../components/BookingModal';

interface Doctor {
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
}

const PatientDashboard: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('All');
  const [loading, setLoading] = useState(true);

  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const specializations = [
    'All',
    'Cardiologist',
    'Dermatologist',
    'Neurologist',
    'Pediatrician',
    'Psychiatrist',
    'General Physician',
  ];

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const response = await api.get('/doctors');
      if (response.data.success) {
        setDoctors(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('specialization', searchTerm);
      if (citySearch) params.append('city', citySearch);
      if (nameSearch) params.append('name', nameSearch);

      const response = await api.get(`/doctors/search?${params.toString()}`);
      if (response.data.success) {
        setDoctors(response.data.data);
      }
    } catch (error) {
      console.error('Error searching doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSpecializationClick = (spec: string) => {
    setSelectedSpecialization(spec);
    const newSpec = spec === 'All' ? '' : spec;
    setSearchTerm(newSpec);

    const params = new URLSearchParams();
    if (newSpec) params.append('specialization', newSpec);
    if (citySearch) params.append('city', citySearch);
    if (nameSearch) params.append('name', nameSearch);

    api.get(`/doctors/search?${params.toString()}`).then((response) => {
      if (response.data.success) {
        setDoctors(response.data.data);
      }
    });
  };

  const handleBookingSuccess = () => {
    setBookingDoctor(null);
    setBookingSuccess(true);
    setTimeout(() => setBookingSuccess(false), 5000);
  };

  return (
    <div className="min-h-full bg-slate-50">
      {bookingSuccess && (
        <div className="fixed top-20 right-4 z-50 bg-green-600 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in border border-green-500">
          <span className="text-2xl">✓</span>
          <div>
            <p className="font-bold">Booking successful!</p>
            <p className="text-sm text-green-100">Your appointment has been confirmed.</p>
          </div>
        </div>
      )}

      {bookingDoctor && (
        <BookingModal
          doctor={bookingDoctor}
          onClose={() => setBookingDoctor(null)}
          onSuccess={handleBookingSuccess}
        />
      )}

      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3">Find Your Doctor</h1>
          <p className="text-blue-100 text-base sm:text-lg max-w-2xl mx-auto mb-8">
            Book appointments with trusted specialists. Search by name, specialty, or city.
          </p>

          <form
            onSubmit={handleSearch}
            className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-4 sm:p-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Doctor name"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="relative">
                <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Specialization"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="City"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors shadow-md"
              >
                <Search className="h-5 w-5" />
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-8">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
            Filter by specialty
          </p>
          <div className="flex flex-wrap gap-2">
            {specializations.map((spec) => (
              <button
                key={spec}
                type="button"
                onClick={() => handleSpecializationClick(spec)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  selectedSpecialization === spec
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : doctors.length > 0 ? (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Showing <span className="font-semibold text-slate-800">{doctors.length}</span> doctors
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {doctors.map((doctor) => (
                <DoctorCard
                  key={doctor.id}
                  doctor={doctor}
                  onBookNow={(doc) => setBookingDoctor({ ...doc, hospitalName: doc.hospitalName ?? '', city: doc.city ?? '' })}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <Search className="h-14 w-14 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No doctors found</h3>
            <p className="text-slate-500 mb-6">Try different filters or clear your search.</p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setNameSearch('');
                setCitySearch('');
                setSelectedSpecialization('All');
                fetchDoctors();
              }}
              className="text-blue-600 font-semibold hover:text-blue-700"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;
