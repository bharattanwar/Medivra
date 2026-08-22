import api from './api';

export interface ReportAnalysisResponse {
  reportId: string;
  patientId: string;
  reportType: string;
  summaryText: string;
  abnormalFindings: string;
  normalFindings: string;
  suggestedQuestions: string;
  recommendedFollowUps: string;
  confidenceLevel: string;
  analyzedAt: string;
}

export interface DoctorRecommendation {
  doctorId: string;
  explanation: string;
}

export interface AppointmentRecommendationResponse {
  id: string;
  patientId: string;
  recommendedSpecialty: string;
  urgencyLevel: string;
  rankedDoctors: string; // JSON String of DoctorRecommendation[]
  aiExplanation: string;
  createdAt: string;
}

export interface FollowUpPlan {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  medicines: string;
  followUpIntervalDays: number;
  startDate: string;
  endDate: string;
  status: string;
}

export interface FollowUpCheckInResponse {
  id: string;
  followUpPlanId: string;
  dayNumber: number;
  responses: string;
  aiAnalysis: string;
  actionRecommended: string;
  createdAt: string;
}

export interface FollowUpProgressResponse {
  planId: string;
  overallProgressSummary: string;
  adherencePercentage: number;
  recoveryTrend: string;
}

export interface ExtractedMedicine {
  extractedName: string;
  matchedMedicineId: string;
  matchedMedicineName: string;
  confidenceScore: number;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
}

export interface PrescriptionExtractionResponse {
  patientId: string;
  rawAiSummary: string;
  medicines: ExtractedMedicine[];
}

/**
 * Service client for Medivra's AI-assisted healthcare capabilities:
 * 1. Medical Report Explainer (PDF/Image OCR + Gemini Analysis)
 * 2. Prescription OCR & Catalog Matcher
 * 3. Smart Doctor Recommender
 * 4. Post-Consultation Follow-Up & Daily Check-In Assistant
 */
export const aiService = {
  // ── 1. Report Analyzer ───────────────────────────────────────────────────

  /** Uploads a medical lab report (PDF/Image) for Gemini AI interpretation */
  analyzeReport: async (patientId: string, reportType: string, file: File): Promise<ReportAnalysisResponse> => {
    const formData = new FormData();
    formData.append('patientId', patientId);
    formData.append('reportType', reportType);
    formData.append('file', file);
    const response = await api.post<ReportAnalysisResponse>('/ai/reports/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** Retrieves summary and findings for a previously analyzed report */
  getReportSummary: async (id: string): Promise<ReportAnalysisResponse> => {
    const response = await api.get<ReportAnalysisResponse>(`/ai/reports/${id}/summary`);
    return response.data;
  },

  /** Retrieves all historical AI-analyzed reports for a given patient */
  getReportsByPatient: async (patientId: string): Promise<ReportAnalysisResponse[]> => {
    const response = await api.get<ReportAnalysisResponse[]>(`/ai/reports/patient/${patientId}`);
    return response.data;
  },

  /** Deletes an analyzed report record and associated summary */
  deleteReport: async (id: string): Promise<void> => {
    await api.delete(`/ai/reports/${id}`);
  },

  // ── 2. Prescription OCR ─────────────────────────────────────────────────

  /** Extracts medicine names, dosages, and schedules from a prescription image */
  extractPrescription: async (patientId: string, file: File): Promise<PrescriptionExtractionResponse> => {
    const formData = new FormData();
    formData.append('patientId', patientId);
    formData.append('file', file);
    const response = await api.post<PrescriptionExtractionResponse>('/ai/prescriptions/extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // ── 3. Appointment Optimizer & Doctor Matcher ───────────────────────────

  /** Recommends matching doctors based on symptom description and patient preferences */
  recommendDoctors: async (data: {
    patientId: string;
    symptoms: string;
    preferences: Record<string, string>;
  }): Promise<AppointmentRecommendationResponse> => {
    const response = await api.post<AppointmentRecommendationResponse>('/ai/appointments/recommend', data);
    return response.data;
  },

  /** Retrieves a recommendation result by its unique ID */
  getRecommendation: async (id: string): Promise<AppointmentRecommendationResponse> => {
    const response = await api.get<AppointmentRecommendationResponse>(`/ai/appointments/recommendations/${id}`);
    return response.data;
  },

  /** Retrieves past doctor recommendation queries by a patient */
  getRecommendationsByPatient: async (patientId: string): Promise<AppointmentRecommendationResponse[]> => {
    const response = await api.get<AppointmentRecommendationResponse[]>(`/ai/appointments/recommendations/patient/${patientId}`);
    return response.data;
  },

  // ── 4. Follow-Up Plan & Daily Recovery Tracker ──────────────────────────

  /** Provisions a post-consultation follow-up plan */
  createFollowUpPlan: async (data: {
    appointmentId: string;
    patientId: string;
    doctorId: string;
    diagnosis: string;
    medicines: unknown[];
    followUpIntervalDays: number;
  }): Promise<FollowUpPlan> => {
    const response = await api.post<FollowUpPlan>('/ai/followup/plans', data);
    return response.data;
  },

  /** Retrieves details for an existing follow-up plan */
  getPlan: async (planId: string): Promise<FollowUpPlan> => {
    const response = await api.get<FollowUpPlan>(`/ai/followup/plans/${planId}`);
    return response.data;
  },

  /** Retrieves all follow-up plans assigned to a patient */
  getPlansByPatient: async (patientId: string): Promise<FollowUpPlan[]> => {
    const response = await api.get<FollowUpPlan[]>(`/ai/followup/plans/patient/${patientId}`);
    return response.data;
  },

  /** Submits a patient's daily check-in responses for AI recovery evaluation */
  processCheckIn: async (data: {
    planId: string;
    dayNumber: number;
    responses: Record<string, string>;
  }): Promise<FollowUpCheckInResponse> => {
    const response = await api.post<FollowUpCheckInResponse>('/ai/followup/checkin', data);
    return response.data;
  },

  /** Retrieves all historical check-in submissions for a follow-up plan */
  getCheckInsForPlan: async (planId: string): Promise<FollowUpCheckInResponse[]> => {
    const response = await api.get<FollowUpCheckInResponse[]>(`/ai/followup/plans/${planId}/checkins`);
    return response.data;
  },

  /** Computes adherence rate and recovery trend analysis for a plan */
  getProgressSummary: async (planId: string): Promise<FollowUpProgressResponse> => {
    const response = await api.get<FollowUpProgressResponse>(`/ai/followup/plans/${planId}/progress`);
    return response.data;
  },
};
