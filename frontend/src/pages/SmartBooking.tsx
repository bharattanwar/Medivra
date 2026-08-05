import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, DollarSign, Star, Activity, User, Loader2, Calendar, CheckCircle2 } from 'lucide-react';
import { aiService, type AppointmentRecommendationResponse, type DoctorRecommendation } from '../services/ai';
import api from '../services/api';
import BookingModal from '../components/BookingModal';

interface DoctorDetail {
  id: string;
  fullName: string;
  specialization: string;
  experienceYears?: number;
  consultationFee: number;
  hospitalName?: string;
  city?: string;
  rating?: number;
  profileImageUrl?: string;
  availableInClinic?: boolean;
  availableVideo?: boolean;
}

export default function SmartBooking() {
  const patientId = localStorage.getItem("userId");
  const navigate = useNavigate();
  const [symptoms, setSymptoms] = useState('');
  const [preferences, setPreferences] = useState({
    budget: 'Medium',
    gender: 'Any',
    distance: 'Any',
    mode: 'Any'
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AppointmentRecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Doctor Details & Booking States
  const [doctorDetailsMap, setDoctorDetailsMap] = useState<Record<string, DoctorDetail>>({});
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [bookingDoctor, setBookingDoctor] = useState<DoctorDetail | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const handleRecommend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !symptoms.trim()) return;

    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const data = await aiService.recommendDoctors({
        patientId,
        symptoms,
        preferences,
      });
      setResult(data);
      fetchDoctorDetails(data.rankedDoctors);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to get recommendations');
    } finally {
      setAnalyzing(false);
    }
  };

  const fetchDoctorDetails = async (rankedJson: string) => {
    try {
      setLoadingDoctors(true);
      const ranked: DoctorRecommendation[] = JSON.parse(rankedJson || '[]');
      const detailsMap: Record<string, DoctorDetail> = {};

      await Promise.all(
        ranked.map(async (rec) => {
          try {
            const res = await api.get(`/doctors/${rec.doctorId}`);
            if (res.data && res.data.data) {
              detailsMap[rec.doctorId] = res.data.data;
            }
          } catch {
            // Fallback mock detail if individual doctor fetch fails
            detailsMap[rec.doctorId] = {
              id: rec.doctorId,
              fullName: `Specialist Doctor (${rec.doctorId.slice(0, 6)})`,
              specialization: result?.recommendedSpecialty || 'Specialist',
              consultationFee: 500,
              experienceYears: 10,
              availableInClinic: true,
              availableVideo: true
            };
          }
        })
      );
      setDoctorDetailsMap(detailsMap);
    } catch (err) {
      console.error('Error fetching doctor details:', err);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const getRankedDoctors = (): DoctorRecommendation[] => {
    if (!result?.rankedDoctors) return [];
    try {
      return JSON.parse(result.rankedDoctors);
    } catch {
      return [];
    }
  };

  const handleOpenBooking = (rec: DoctorRecommendation) => {
    const detail = doctorDetailsMap[rec.doctorId] || {
      id: rec.doctorId,
      fullName: `Doctor (${rec.doctorId.slice(0, 6)})`,
      specialization: result?.recommendedSpecialty || 'Specialist',
      consultationFee: 500,
      availableInClinic: true,
      availableVideo: true
    };
    setBookingDoctor(detail);
  };

  const handleBookingSuccess = () => {
    setBookingDoctor(null);
    setBookingSuccess(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {bookingSuccess && (
        <div className="fixed top-20 right-6 z-50 bg-green-600 text-white p-5 rounded-2xl shadow-2xl flex items-center gap-4 animate-fade-in max-w-md border border-green-500">
          <CheckCircle2 className="w-8 h-8 shrink-0 text-white" />
          <div className="flex-1">
            <p className="font-bold text-base">Appointment Booked Successfully!</p>
            <p className="text-xs text-green-100 mt-0.5">Your slot is confirmed. View details in Appointments History.</p>
          </div>
          <button
            onClick={() => navigate('/patient/appointments')}
            className="px-3 py-1.5 bg-white text-green-800 rounded-lg text-xs font-bold hover:bg-green-50 transition-colors shrink-0 cursor-pointer"
          >
            History
          </button>
        </div>
      )}

      {bookingDoctor && (
        <BookingModal
          doctor={bookingDoctor}
          onClose={() => setBookingDoctor(null)}
          onSuccess={handleBookingSuccess}
        />
      )}

      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">AI Smart Appointment Optimizer</h1>
        <p className="mt-2 text-lg text-gray-500">
          Describe your symptoms, and our AI will find the perfect specialist for your needs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Form */}
        <div className="lg:col-span-5">
          <div className="bg-white shadow rounded-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                <Search className="h-5 w-5 text-indigo-500 mr-2" />
                Find Your Doctor
              </h3>
            </div>
            <div className="p-6">
              <form onSubmit={handleRecommend} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Describe your symptoms in detail
                  </label>
                  <textarea
                    rows={4}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border"
                    placeholder="e.g. I've had a persistent migraine for the last 2 weeks accompanied by slight nausea..."
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <DollarSign className="h-4 w-4 mr-1 text-gray-400" />
                      Budget Range
                    </label>
                    <select
                      value={preferences.budget}
                      onChange={(e) => setPreferences({ ...preferences, budget: e.target.value })}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                    >
                      <option>Any</option>
                      <option>Low (&lt; $50)</option>
                      <option>Medium ($50 - $150)</option>
                      <option>Premium (&gt; $150)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <User className="h-4 w-4 mr-1 text-gray-400" />
                      Preferred Gender
                    </label>
                    <select
                      value={preferences.gender}
                      onChange={(e) => setPreferences({ ...preferences, gender: e.target.value })}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                    >
                      <option>Any</option>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                      Distance
                    </label>
                    <select
                      value={preferences.distance}
                      onChange={(e) => setPreferences({ ...preferences, distance: e.target.value })}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                    >
                      <option>Any</option>
                      <option>&lt; 5 miles</option>
                      <option>&lt; 15 miles</option>
                      <option>&lt; 25 miles</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Activity className="h-4 w-4 mr-1 text-gray-400" />
                      Consultation Mode
                    </label>
                    <select
                      value={preferences.mode}
                      onChange={(e) => setPreferences({ ...preferences, mode: e.target.value })}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                    >
                      <option>Any</option>
                      <option>In-Clinic Only</option>
                      <option>Video Consult Only</option>
                    </select>
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!symptoms.trim() || analyzing}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 cursor-pointer"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                      Analyzing Symptoms...
                    </>
                  ) : (
                    'Get AI Recommendations'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-7">
          {analyzing ? (
            <div className="bg-white shadow rounded-lg p-12 flex flex-col items-center justify-center h-full min-h-[400px]">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20"></div>
                <div className="bg-indigo-100 p-4 rounded-full relative">
                  <Activity className="h-10 w-10 text-indigo-600 animate-pulse" />
                </div>
              </div>
              <p className="mt-6 text-lg font-medium text-gray-900">AI is analyzing your symptoms...</p>
              <p className="mt-2 text-sm text-gray-500 text-center max-w-sm">
                Evaluating urgency, determining the right specialty, and ranking top doctors based on your preferences.
              </p>
            </div>
          ) : result ? (
            <div className="space-y-6">
              {/* Analysis Header */}
              <div className="bg-white shadow rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between border-l-4 border-indigo-500">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Recommended Specialty</h3>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">{result.recommendedSpecialty}</p>
                </div>
                <div className="mt-4 sm:mt-0 text-left sm:text-right">
                  <h3 className="text-sm font-medium text-gray-500">Urgency Level</h3>
                  <span className={`inline-flex mt-1 items-center px-3 py-1 rounded-full text-sm font-medium ${result.urgencyLevel === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                      result.urgencyLevel === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                        result.urgencyLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                    }`}>
                    {result.urgencyLevel}
                  </span>
                </div>
              </div>

              <div className="bg-indigo-50 rounded-lg p-5 text-sm text-indigo-800 shadow-sm border border-indigo-100">
                <p><strong>AI Reasoning:</strong> {result.aiExplanation}</p>
              </div>

              {/* Doctor List */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center justify-between">
                  <span className="flex items-center">
                    <Star className="h-5 w-5 text-yellow-400 mr-2" />
                    Top Recommended Doctors
                  </span>
                  {loadingDoctors && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
                </h3>

                {getRankedDoctors().length === 0 && !loadingDoctors ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-3">
                    <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                      <Search className="h-7 w-7" />
                    </div>
                    <h4 className="text-lg font-bold text-amber-900">No Matching Doctors Found</h4>
                    <p className="text-sm text-amber-700 max-w-md mx-auto leading-relaxed">
                      We couldn't find any registered doctors whose specialization matches your symptoms.
                      Please try describing your symptoms differently, or consult a General Physician.
                    </p>
                  </div>
                ) : (
                  getRankedDoctors().map((rec, index) => {
                    const docInfo = doctorDetailsMap[rec.doctorId];
                    const docName = docInfo?.fullName || `Dr. Specialist (${rec.doctorId.slice(0, 6)})`;
                    const docSpec = docInfo?.specialization || result.recommendedSpecialty;
                    const fee = docInfo?.consultationFee || 500;
                    const exp = docInfo?.experienceYears || 8;
                    const hospital = docInfo?.hospitalName || 'Medivra Multi-Specialty Clinic';

                    return (
                      <div key={rec.doctorId} className="bg-white shadow-md rounded-2xl overflow-hidden border border-slate-200 transition-all hover:border-indigo-300 relative">
                        <div className="absolute top-0 right-0 bg-indigo-600 text-white px-3 py-1 rounded-bl-xl font-bold text-xs shadow">
                          #{index + 1} Match
                        </div>
                        <div className="p-6">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-indigo-100 text-indigo-700 font-bold rounded-2xl flex items-center justify-center text-xl shrink-0 border border-indigo-200">
                                {docName.replace('Dr. ', '').charAt(0)}
                              </div>
                              <div>
                                <h4 className="text-lg font-bold text-slate-900">{docName}</h4>
                                <p className="text-xs text-indigo-600 font-semibold">{docSpec} • {exp} Years Exp.</p>
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                  <MapPin className="h-3 w-3" /> {hospital}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 sm:flex-col sm:items-end w-full sm:w-auto justify-between border-t sm:border-t-0 pt-3 sm:pt-0">
                              <div>
                                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Fee</p>
                                <p className="text-xl font-extrabold text-slate-900">₹{fee}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenBooking(rec)}
                                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                              >
                                <Calendar className="h-4 w-4" /> Book Appointment
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-xs leading-relaxed text-slate-700">
                            <span className="font-bold text-slate-900">Why recommended:</span> {rec.explanation}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-12 flex flex-col items-center justify-center h-full min-h-[400px] border-2 border-dashed border-gray-200">
              <div className="bg-gray-50 p-4 rounded-full">
                <Search className="h-10 w-10 text-gray-400" />
              </div>
              <p className="mt-6 text-lg font-medium text-gray-900">Ready to find your doctor</p>
              <p className="mt-2 text-sm text-gray-500 text-center max-w-sm">
                Fill out the form on the left to get personalized AI recommendations.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

