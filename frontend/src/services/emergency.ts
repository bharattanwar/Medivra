import api from './api';

export type EmergencyType =
  | 'CARDIAC'
  | 'ACCIDENT'
  | 'STROKE'
  | 'PREGNANCY'
  | 'TRAUMA'
  | 'RESPIRATORY'
  | 'PEDIATRIC'
  | 'GENERAL';

export type EmergencyStatus =
  | 'PENDING'
  | 'SEARCHING'
  | 'AMBULANCE_ASSIGNED'
  | 'EN_ROUTE'
  | 'ARRIVED_AT_PATIENT'
  | 'TRANSPORTING'
  | 'ARRIVED_AT_HOSPITAL'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ESCALATED';

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

export interface AmbulanceRegistrationRequest {
  vehicleNumber: string;
  ambulanceType: string;
  equipmentNotes?: string;
}

// ── Patient SOS API ──────────────────────────────────────────────────────────

/** Activates an SOS request and initiates ambulance search */
export const triggerSos = async (request: SosRequest): Promise<EmergencyResponse> => {
  const res = await api.post('/emergency/sos', request);
  return res.data.data;
};

/** Retrieves real-time status and timeline for an emergency request */
export const getEmergencyStatus = async (emergencyId: string): Promise<EmergencyResponse> => {
  const res = await api.get(`/emergency/${emergencyId}`);
  return res.data.data;
};

/** Cancels an active SOS activation and frees assigned fleet */
export const cancelEmergency = async (emergencyId: string): Promise<EmergencyResponse> => {
  const res = await api.put(`/emergency/${emergencyId}/cancel`);
  return res.data.data;
};

/** Retrieves emergency request history for the logged-in patient */
export const getEmergencyHistory = async (): Promise<EmergencyResponse[]> => {
  const res = await api.get('/emergency/history');
  return res.data.data;
};

// ── Emergency Contacts ────────────────────────────────────────────────────────

/** Retrieves registered emergency contacts for a patient */
export const getEmergencyContacts = async (): Promise<EmergencyContact[]> => {
  const res = await api.get('/emergency/contacts');
  return res.data.data;
};

/** Adds a new emergency contact for rapid SMS/notification alerting */
export const addEmergencyContact = async (req: EmergencyContactRequest): Promise<EmergencyContact> => {
  const res = await api.post('/emergency/contacts', req);
  return res.data.data;
};

/** Removes an emergency contact */
export const deleteEmergencyContact = async (contactId: string): Promise<void> => {
  await api.delete(`/emergency/contacts/${contactId}`);
};

// ── Ambulance Driver & Partner API ────────────────────────────────────────────

/** Registers an ambulance vehicle in the dispatch network */
export const registerAmbulance = async (data: AmbulanceRegistrationRequest): Promise<{ id: string; [key: string]: any }> => {
  const res = await api.post('/ambulance/register', data);
  return res.data.data;
};

/** Marks an ambulance online and available for nearby dispatch matching */
export const goOnline = async (ambulanceId: string): Promise<void> => {
  await api.put(`/ambulance/${ambulanceId}/online`);
};

/** Sets an ambulance offline */
export const goOffline = async (ambulanceId: string): Promise<void> => {
  await api.put(`/ambulance/${ambulanceId}/offline`);
};

/** Broadcasts current GPS telemetry coordinates for live ETA calculation */
export const pushLocation = async (ambulanceId: string, lat: number, lng: number): Promise<void> => {
  await api.post(`/ambulance/${ambulanceId}/location`, { lat, lng });
};

/** Driver accepts an incoming emergency dispatch alert */
export const acceptEmergency = async (emergencyId: string, ambulanceId: string): Promise<EmergencyResponse> => {
  const res = await api.put(`/ambulance/emergency/${emergencyId}/accept`, { ambulanceId });
  return res.data.data;
};

/** Driver rejects an emergency dispatch alert */
export const rejectEmergency = async (emergencyId: string): Promise<void> => {
  await api.put(`/ambulance/emergency/${emergencyId}/reject`);
};

/** Advances trip status (EN_ROUTE, ARRIVED_AT_PATIENT, TRANSPORTING, ARRIVED_AT_HOSPITAL, COMPLETED) */
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

/** Fetches active emergency assigned to current driver session */
export const getActiveEmergency = async (): Promise<EmergencyResponse | null> => {
  const res = await api.get('/ambulance/emergency/active');
  return res.data.data;
};

// ── Hospital Emergency Dashboard API ─────────────────────────────────────────

/** Retrieves active emergencies en route to hospital */
export const getHospitalActiveEmergencies = async (hospitalId?: string): Promise<EmergencyResponse[]> => {
  const params = hospitalId ? `?hospitalId=${hospitalId}` : '';
  const res = await api.get(`/hospital/emergencies/active${params}`);
  return res.data.data;
};

/** Retrieves fleet readiness status */
export const getFleetStatus = async (): Promise<unknown[]> => {
  const res = await api.get('/hospital/ambulances');
  return res.data.data;
};

/** Retrieves hospital emergency volume and SLA response analytics */
export const getEmergencyAnalytics = async (): Promise<unknown> => {
  const res = await api.get('/hospital/emergencies/analytics');
  return res.data.data;
};
