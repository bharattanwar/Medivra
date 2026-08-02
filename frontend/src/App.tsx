import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DoctorRegistration from './pages/DoctorRegistration';
import Dashboard from './pages/Dashboard';
import PatientDashboard from './pages/PatientDashboard';
import MyAppointments from './pages/MyAppointments';
import ManageAvailability from './pages/ManageAvailability';
import DoctorAppointments from './pages/DoctorAppointments';
import PaymentHistory from './pages/PaymentHistory';
import ConsultationRoom from './pages/ConsultationRoom';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminDoctors from './pages/AdminDoctors';
import AdminAppointments from './pages/AdminAppointments';
import PharmacyRegistration from './pages/PharmacyRegistration';
import PharmacyDashboard from './pages/PharmacyDashboard';
import PharmacyFinder from './pages/PharmacyFinder';
import OrderTracking from './pages/OrderTracking';
import EmergencySOS from './pages/EmergencySOS';
import AmbulanceDashboard from './pages/AmbulanceDashboard';
import HospitalEmergencyDashboard from './pages/HospitalEmergencyDashboard';
import ReportExplainer from './pages/ReportExplainer';
import SmartBooking from './pages/SmartBooking';
import PrescriptionScanner from './pages/PrescriptionScanner';

import { WebSocketProvider } from './context/WebSocketContext';

function App() {
  return (
    <WebSocketProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/doctor-registration" element={<DoctorRegistration />} />
            
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/patient/dashboard" element={<PrivateRoute allowedRoles={['patient']}><PatientDashboard /></PrivateRoute>} />
            <Route path="/patient/appointments" element={<PrivateRoute allowedRoles={['patient']}><MyAppointments /></PrivateRoute>} />
            <Route path="/patient/payments" element={<PrivateRoute allowedRoles={['patient']}><PaymentHistory /></PrivateRoute>} />
            
            {/* AI Routes */}
            <Route path="/patient/ai/reports" element={<PrivateRoute allowedRoles={['patient']}><ReportExplainer /></PrivateRoute>} />
            <Route path="/patient/ai/booking" element={<PrivateRoute allowedRoles={['patient']}><SmartBooking /></PrivateRoute>} />
            <Route path="/patient/ai/prescriptions" element={<PrivateRoute allowedRoles={['patient']}><PrescriptionScanner /></PrivateRoute>} />

            <Route path="/doctor/availability" element={<PrivateRoute allowedRoles={['doctor']}><ManageAvailability /></PrivateRoute>} />
            <Route path="/doctor/appointments" element={<PrivateRoute allowedRoles={['doctor']}><DoctorAppointments /></PrivateRoute>} />
            <Route path="/consultation/:appointmentId" element={<PrivateRoute allowedRoles={['patient', 'doctor']}><ConsultationRoom /></PrivateRoute>} />
            
            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={<PrivateRoute allowedRoles={['admin']}><AdminDashboard /></PrivateRoute>} />
            <Route path="/admin/users" element={<PrivateRoute allowedRoles={['admin']}><AdminUsers /></PrivateRoute>} />
            <Route path="/admin/doctors" element={<PrivateRoute allowedRoles={['admin']}><AdminDoctors /></PrivateRoute>} />
            <Route path="/admin/appointments" element={<PrivateRoute allowedRoles={['admin']}><AdminAppointments /></PrivateRoute>} />

            {/* Pharmacy Routes */}
            <Route path="/pharmacy/register" element={<PharmacyRegistration />} />
            <Route path="/pharmacy/dashboard" element={<PrivateRoute allowedRoles={['pharmacy']}><PharmacyDashboard /></PrivateRoute>} />
            <Route path="/patient/pharmacy" element={<PrivateRoute allowedRoles={['patient']}><PharmacyFinder /></PrivateRoute>} />
            <Route path="/patient/orders" element={<PrivateRoute allowedRoles={['patient']}><OrderTracking /></PrivateRoute>} />

            {/* Emergency SOS Routes */}
            <Route path="/patient/emergency" element={<PrivateRoute allowedRoles={['patient']}><EmergencySOS /></PrivateRoute>} />
            <Route path="/ambulance/dashboard" element={<PrivateRoute allowedRoles={['ambulance']}><AmbulanceDashboard /></PrivateRoute>} />
            <Route path="/hospital/emergencies" element={<PrivateRoute allowedRoles={['hospital']}><HospitalEmergencyDashboard /></PrivateRoute>} />
          </Routes>
        </Layout>
      </Router>
    </WebSocketProvider>
  );
}

export default App;
