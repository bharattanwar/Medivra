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

export const aiService = {
    // 1. Report Analyzer
    analyzeReport: async (patientId: string, reportType: string, file: File) => {
        const formData = new FormData();
        formData.append('patientId', patientId);
        formData.append('reportType', reportType);
        formData.append('file', file);
        const response = await api.post<ReportAnalysisResponse>('/ai/reports/analyze', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    getReportSummary: async (id: string) => {
        const response = await api.get<ReportAnalysisResponse>(`/ai/reports/${id}/summary`);
        return response.data;
    },
    getReportsByPatient: async (patientId: string) => {
        const response = await api.get<ReportAnalysisResponse[]>(`/ai/reports/patient/${patientId}`);
        return response.data;
    },
    deleteReport: async (id: string) => {
        const response = await api.delete(`/ai/reports/${id}`);
        return response.data;
    },

    // 1.5 Prescription OCR
    extractPrescription: async (patientId: string, file: File) => {
        const formData = new FormData();
        formData.append('patientId', patientId);
        formData.append('file', file);
        const response = await api.post<PrescriptionExtractionResponse>('/ai/prescriptions/extract', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // 2. Appointment Optimizer
    recommendDoctors: async (data: { patientId: string, symptoms: string, preferences: Record<string, string> }) => {
        const response = await api.post<AppointmentRecommendationResponse>('/ai/appointments/recommend', data);
        return response.data;
    },
    getRecommendation: async (id: string) => {
        const response = await api.get<AppointmentRecommendationResponse>(`/ai/appointments/recommendations/${id}`);
        return response.data;
    },
    getRecommendationsByPatient: async (patientId: string) => {
        const response = await api.get<AppointmentRecommendationResponse[]>(`/ai/appointments/recommendations/patient/${patientId}`);
        return response.data;
    },

    // 3. Follow Up Predictor
    createFollowUpPlan: async (data: { appointmentId: string, patientId: string, doctorId: string, diagnosis: string, medicines: any[], followUpIntervalDays: number }) => {
        const response = await api.post<FollowUpPlan>('/ai/followup/plans', data);
        return response.data;
    },
    getPlan: async (planId: string) => {
        const response = await api.get<FollowUpPlan>(`/ai/followup/plans/${planId}`);
        return response.data;
    },
    getPlansByPatient: async (patientId: string) => {
        const response = await api.get<FollowUpPlan[]>(`/ai/followup/plans/patient/${patientId}`);
        return response.data;
    },
    processCheckIn: async (data: { planId: string, dayNumber: number, responses: Record<string, string> }) => {
        const response = await api.post<FollowUpCheckInResponse>('/ai/followup/checkin', data);
        return response.data;
    },
    getCheckInsForPlan: async (planId: string) => {
        const response = await api.get<FollowUpCheckInResponse[]>(`/ai/followup/plans/${planId}/checkins`);
        return response.data;
    },
    getProgressSummary: async (planId: string) => {
        const response = await api.get<FollowUpProgressResponse>(`/ai/followup/plans/${planId}/progress`);
        return response.data;
    }
};
