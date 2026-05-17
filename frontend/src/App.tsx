import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DoctorRegistration from './pages/DoctorRegistration';
import Dashboard from './pages/Dashboard';
import PatientDashboard from './pages/PatientDashboard';
import MyAppointments from './pages/MyAppointments';
import ManageAvailability from './pages/ManageAvailability';
import DoctorAppointments from './pages/DoctorAppointments';
import PaymentHistory from './pages/PaymentHistory';

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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/patient/dashboard" element={<PatientDashboard />} />
            <Route path="/patient/appointments" element={<MyAppointments />} />
            <Route path="/patient/payments" element={<PaymentHistory />} />
            <Route path="/doctor/availability" element={<ManageAvailability />} />
            <Route path="/doctor/appointments" element={<DoctorAppointments />} />
          </Routes>
        </Layout>
      </Router>
    </WebSocketProvider>
  );
}

export default App;
