import api from './api';

export interface MedicationDoseLog {
  id: string;
  treatmentMedicationId: string;
  medicineName: string;
  dosage: string;
  patientId: string;
  doseDate: string;
  doseSlot: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
  status: 'SCHEDULED' | 'TAKEN' | 'SKIPPED' | 'NOT_REPORTED';
  confirmedAt?: string;
  patientNote?: string;
}

export interface CareTask {
  id: string;
  patientId: string;
  treatmentPlanId?: string;
  taskType: 'MEDICATION_DOSE' | 'LAB_TEST' | 'REPORT_UPLOAD' | 'FOLLOW_UP_CONSULTATION' | 'DAILY_CHECK_IN';
  title: string;
  description?: string;
  dueDate: string;
  dueTimeSlot?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'OVERDUE';
  referenceId?: string;
  completedAt?: string;
}

export interface TreatmentLabTest {
  id: string;
  treatmentPlanId: string;
  patientId: string;
  testName: string;
  urgency: string;
  dueDate?: string;
  instructions?: string;
  status: 'PENDING' | 'ORDERED' | 'COMPLETED' | 'CANCELLED';
  reportId?: string;
}

export interface TreatmentMedication {
  id: string;
  treatmentPlanId: string;
  prescriptionItemId?: string;
  medicineName: string;
  strength?: string;
  dosage: string;
  frequency: string;
  totalDays: number;
  startDate: string;
  endDate?: string;
  instructions?: string;
  status: string;
  dayNumber?: number;
  todayDoses?: MedicationDoseLog[];
}

export interface TreatmentPlan {
  id: string;
  patientId: string;
  doctorId?: string;
  doctorName?: string;
  appointmentId?: string;
  medicalRecordId?: string;
  title: string;
  diagnosis: string;
  instructions?: string;
  startDate: string;
  endDate?: string;
  followUpDate?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'DISCONTINUED' | 'ESCALATED';
  totalMedications: number;
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
  medications?: TreatmentMedication[];
  labTests?: TreatmentLabTest[];
  tasks?: CareTask[];
  createdAt: string;
}

export interface NextActionResponse {
  patientId: string;
  activePlan?: TreatmentPlan;
  todayDoses: MedicationDoseLog[];
  todayTasks: CareTask[];
  nextTasks: CareTask[];
  pendingLabTests: TreatmentLabTest[];
  nextFollowUpRecommendation?: string;
  followUpDoctorName?: string;
  followUpDoctorId?: string;
  takenDosesToday: number;
  totalDosesToday: number;
  completedTasksTotal: number;
  pendingTasksTotal: number;
}

export interface LabParameterReading {
  id: string;
  reportId?: string;
  numericValue?: number;
  rawValue: string;
  flag: string;
  testDate: string;
}

export interface LabTrend {
  parameterName: string;
  testCategory?: string;
  unit?: string;
  referenceRangeMin?: number;
  referenceRangeMax?: number;
  referenceRangeText?: string;
  latestValue?: number;
  latestRawValue: string;
  latestFlag: string;
  latestDate: string;
  previousValue?: number;
  previousRawValue?: string;
  previousFlag?: string;
  previousDate?: string;
  deltaNumeric?: number;
  deltaPercentage?: number;
  trendDirection?: 'IMPROVING' | 'WORSENING' | 'STABLE' | 'INCREASED' | 'DECREASED' | 'INITIAL_BASELINE';
  statusTransition?: string;
  history: LabParameterReading[];
}

export interface HealthTimelineEvent {
  id: string;
  eventType: 'CONSULTATION' | 'PRESCRIPTION' | 'TREATMENT_PLAN' | 'LAB_REPORT' | 'MEDICATION_DOSE' | 'PHARMACY_ORDER' | 'CARE_TASK';
  timestamp: string;
  title: string;
  subtitle?: string;
  description?: string;
  status: string;
  statusBadgeColor: string;
  iconType: string;
  referenceId?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface DoctorBrief {
  patientId: string;
  patientName: string;
  patientAge?: number;
  patientGender?: string;
  activeTreatmentPlan?: TreatmentPlan;
  activeDiagnosis?: string;
  treatmentStartDate?: string;
  targetFollowUpDate?: string;
  totalDosesScheduled: number;
  dosesConfirmedTaken: number;
  dosesMarkedSkipped: number;
  dosesNotReported: number;
  adherenceSummaryNote: string;
  labTrends: LabTrend[];
  lastConsultationDate?: string;
  lastDoctorName?: string;
  lastDoctorNotes?: string;
  lastPrescriptionSummary?: string;
  pendingCareTasks: CareTask[];
  pendingLabTests: TreatmentLabTest[];
}

export interface AiContextResponse {
  answer: string;
  contextSummary: string;
  sourceRecords: string[];
  suggestedNextQuestions: string[];
}

export const journeyService = {
  getPatientDashboard: async (patientId: string) => {
    const res = await api.get(`/journey/patient/${patientId}/dashboard`);
    return res.data;
  },

  getNextActions: async (patientId: string): Promise<NextActionResponse> => {
    const res = await api.get(`/journey/patient/${patientId}/next-actions`);
    return res.data;
  },

  getTimeline: async (patientId: string): Promise<HealthTimelineEvent[]> => {
    const res = await api.get(`/journey/patient/${patientId}/timeline`);
    return res.data;
  },

  getTreatmentPlans: async (patientId: string): Promise<TreatmentPlan[]> => {
    const res = await api.get(`/journey/patient/${patientId}/treatment-plans`);
    return res.data;
  },

  getTreatmentPlanById: async (planId: string): Promise<TreatmentPlan> => {
    const res = await api.get(`/journey/treatment-plan/${planId}`);
    return res.data;
  },

  confirmDose: async (doseLogId: string, status: 'TAKEN' | 'SKIPPED', patientNote?: string): Promise<MedicationDoseLog> => {
    const res = await api.post(`/journey/dose-log/${doseLogId}/status`, { status, patientNote });
    return res.data;
  },

  completeTask: async (taskId: string): Promise<CareTask> => {
    const res = await api.post(`/journey/task/${taskId}/complete`);
    return res.data;
  },

  getLabTrends: async (patientId: string): Promise<LabTrend[]> => {
    const res = await api.get(`/journey/patient/${patientId}/lab-trends`);
    return res.data;
  },

  getDoctorBrief: async (patientId: string): Promise<DoctorBrief> => {
    const res = await api.get(`/journey/doctor-brief/${patientId}`);
    return res.data;
  },

  askAiHealthContext: async (patientId: string, question: string): Promise<AiContextResponse> => {
    const res = await api.post('/journey/ai-context/ask', { patientId, question });
    return res.data;
  }
};
