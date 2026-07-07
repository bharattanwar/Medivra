import api from './api';

export type EmergencyType =
  | 'CARDIAC' | 'ACCIDENT' | 'STROKE' | 'PREGNANCY'
  | 'TRAUMA' | 'RESPIRATORY' | 'PEDIATRIC' | 'GENERAL';

export type EmergencyStatus =
  | 'PENDING' | 'SEARCHING' | 'AMBULANCE_ASSIGNED' | 'EN_ROUTE'
  | 'ARRIVED_AT_PATIENT' | 'TRANSPORTING' | 'ARRIVED_AT_HOSPITAL'
  | 'COMPLETED' | 'CANCELLED' | 'ESCALATED';

export interface TimelineEntry {
  event: string;
  description: string;
  timestamp: string;
}

export interface EmergencyResponse {
  id: string;
  patientId: string;
  patientName: string;
  patientLat: number;
  patientLng: number;
  patientAddress: string;
  emergencyType: EmergencyType;
  status: EmergencyStatus;
  estimatedArrivalMinutes: number | null;
  escalationCount: number;
  createdAt: string;
  assignedAmbulanceId: string | null;
  vehicleNumber: string | null;
  ambulanceType: string | null;
  ambulanceLat: number | null;
  ambulanceLng: number | null;
  driverName: string | null;
  driverPhone: string | null;
  timeline: TimelineEntry[];
}

export interface EmergencyContact {
  id: string;
  patientId: string;
  name: string;
  phone: string;
  email: string;
  relationship: string;
}

export interface SosRequest {
  lat: number;
  lng: number;
  emergencyType: EmergencyType;
  patientAddress?: string;
  notes?: string;
}

export interface EmergencyContactRequest {
  name: string;
  phone: string;
  email?: string;
  relationship?: string;
}

// ── SOS API ──────────────────────────────────────────────────────────────────

export const triggerSos = async (request: SosRequest): Promise<EmergencyResponse> => {
  const res = await api.post('/emergency/sos', request);
  return res.data.data;
};

export const getEmergencyStatus = async (emergencyId: string): Promise<EmergencyResponse> => {
  const res = await api.get(`/emergency/${emergencyId}`);
  return res.data.data;
};

export const cancelEmergency = async (emergencyId: string): Promise<EmergencyResponse> => {
  const res = await api.put(`/emergency/${emergencyId}/cancel`);
  return res.data.data;
};

export const getEmergencyHistory = async (): Promise<EmergencyResponse[]> => {
  const res = await api.get('/emergency/history');
  return res.data.data;
};

// ── Emergency Contacts ────────────────────────────────────────────────────────

export const getEmergencyContacts = async (): Promise<EmergencyContact[]> => {
  const res = await api.get('/emergency/contacts');
  return res.data.data;
};

export const addEmergencyContact = async (req: EmergencyContactRequest): Promise<EmergencyContact> => {
  const res = await api.post('/emergency/contacts', req);
  return res.data.data;
};

export const deleteEmergencyContact = async (contactId: string): Promise<void> => {
  await api.delete(`/emergency/contacts/${contactId}`);
};

// ── Ambulance Partner API ─────────────────────────────────────────────────────

export const registerAmbulance = async (data: {
  vehicleNumber: string;
  ambulanceType: string;
  equipmentNotes?: string;
}): Promise<any> => {
  const res = await api.post('/ambulance/register', data);
  return res.data.data;
};

export const goOnline = async (ambulanceId: string): Promise<void> => {
  await api.put(`/ambulance/${ambulanceId}/online`);
};

export const goOffline = async (ambulanceId: string): Promise<void> => {
  await api.put(`/ambulance/${ambulanceId}/offline`);
};

export const pushLocation = async (ambulanceId: string, lat: number, lng: number): Promise<void> => {
  await api.post(`/ambulance/${ambulanceId}/location`, { lat, lng });
};

export const acceptEmergency = async (emergencyId: string, ambulanceId: string): Promise<EmergencyResponse> => {
  const res = await api.put(`/ambulance/emergency/${emergencyId}/accept`, { ambulanceId });
  return res.data.data;
};

export const rejectEmergency = async (emergencyId: string): Promise<void> => {
  await api.put(`/ambulance/emergency/${emergencyId}/reject`);
};

export const updateTripStatus = async (
  emergencyId: string,
  newStatus: EmergencyStatus,
  notes?: string
): Promise<EmergencyResponse> => {
  const res = await api.put(`/ambulance/emergency/${emergencyId}/status`, {
    emergencyId,
    newStatus,
    notes,
  });
  return res.data.data;
};

export const getActiveEmergency = async (): Promise<EmergencyResponse | null> => {
  const res = await api.get('/ambulance/emergency/active');
  return res.data.data;
};

// ── Hospital Dashboard API ────────────────────────────────────────────────────

export const getHospitalActiveEmergencies = async (hospitalId?: string): Promise<EmergencyResponse[]> => {
  const params = hospitalId ? `?hospitalId=${hospitalId}` : '';
  const res = await api.get(`/hospital/emergencies/active${params}`);
  return res.data.data;
};

export const getFleetStatus = async (): Promise<any[]> => {
  const res = await api.get('/hospital/ambulances');
  return res.data.data;
};

export const getEmergencyAnalytics = async (): Promise<any> => {
  const res = await api.get('/hospital/emergencies/analytics');
  return res.data.data;
};
