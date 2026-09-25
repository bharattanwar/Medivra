package com.app.record.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class DoctorBriefResponse {
    private UUID patientId;
    private String patientName;
    private Integer patientAge;
    private String patientGender;
    
    // Active / Previous Treatment Info
    private TreatmentPlanDto activeTreatmentPlan;
    private String activeDiagnosis;
    private LocalDate treatmentStartDate;
    private LocalDate targetFollowUpDate;

    // Explicit Adherence Counts (Objective confirmed numbers only)
    private Integer totalDosesScheduled;
    private Integer dosesConfirmedTaken;
    private Integer dosesMarkedSkipped;
    private Integer dosesNotReported;
    private String adherenceSummaryNote; // e.g., "14 doses confirmed taken, 2 doses marked as skipped, 0 unreported"

    // Latest Deterministic Lab Parameters & Trends
    private List<LabTrendResponse> labTrends;

    // Last Consultation Summary
    private String lastConsultationDate;
    private String lastDoctorName;
    private String lastDoctorNotes;
    private String lastPrescriptionSummary;

    // Pending Action Items / Care Tasks
    private List<CareTaskDto> pendingCareTasks;
    private List<TreatmentLabTestDto> pendingLabTests;

    public DoctorBriefResponse() {}

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public String getPatientName() { return patientName; }
    public void setPatientName(String patientName) { this.patientName = patientName; }

    public Integer getPatientAge() { return patientAge; }
    public void setPatientAge(Integer patientAge) { this.patientAge = patientAge; }

    public String getPatientGender() { return patientGender; }
    public void setPatientGender(String patientGender) { this.patientGender = patientGender; }

    public TreatmentPlanDto getActiveTreatmentPlan() { return activeTreatmentPlan; }
    public void setActiveTreatmentPlan(TreatmentPlanDto activeTreatmentPlan) { this.activeTreatmentPlan = activeTreatmentPlan; }

    public String getActiveDiagnosis() { return activeDiagnosis; }
    public void setActiveDiagnosis(String activeDiagnosis) { this.activeDiagnosis = activeDiagnosis; }

    public LocalDate getTreatmentStartDate() { return treatmentStartDate; }
    public void setTreatmentStartDate(LocalDate treatmentStartDate) { this.treatmentStartDate = treatmentStartDate; }

    public LocalDate getTargetFollowUpDate() { return targetFollowUpDate; }
    public void setTargetFollowUpDate(LocalDate targetFollowUpDate) { this.targetFollowUpDate = targetFollowUpDate; }

    public Integer getTotalDosesScheduled() { return totalDosesScheduled; }
    public void setTotalDosesScheduled(Integer totalDosesScheduled) { this.totalDosesScheduled = totalDosesScheduled; }

    public Integer getDosesConfirmedTaken() { return dosesConfirmedTaken; }
    public void setDosesConfirmedTaken(Integer dosesConfirmedTaken) { this.dosesConfirmedTaken = dosesConfirmedTaken; }

    public Integer getDosesMarkedSkipped() { return dosesMarkedSkipped; }
    public void setDosesMarkedSkipped(Integer dosesMarkedSkipped) { this.dosesMarkedSkipped = dosesMarkedSkipped; }

    public Integer getDosesNotReported() { return dosesNotReported; }
    public void setDosesNotReported(Integer dosesNotReported) { this.dosesNotReported = dosesNotReported; }

    public String getAdherenceSummaryNote() { return adherenceSummaryNote; }
    public void setAdherenceSummaryNote(String adherenceSummaryNote) { this.adherenceSummaryNote = adherenceSummaryNote; }

    public List<LabTrendResponse> getLabTrends() { return labTrends; }
    public void setLabTrends(List<LabTrendResponse> labTrends) { this.labTrends = labTrends; }

    public String getLastConsultationDate() { return lastConsultationDate; }
    public void setLastConsultationDate(String lastConsultationDate) { this.lastConsultationDate = lastConsultationDate; }

    public String getLastDoctorName() { return lastDoctorName; }
    public void setLastDoctorName(String lastDoctorName) { this.lastDoctorName = lastDoctorName; }

    public String getLastDoctorNotes() { return lastDoctorNotes; }
    public void setLastDoctorNotes(String lastDoctorNotes) { this.lastDoctorNotes = lastDoctorNotes; }

    public String getLastPrescriptionSummary() { return lastPrescriptionSummary; }
    public void setLastPrescriptionSummary(String lastPrescriptionSummary) { this.lastPrescriptionSummary = lastPrescriptionSummary; }

    public List<CareTaskDto> getPendingCareTasks() { return pendingCareTasks; }
    public void setPendingCareTasks(List<CareTaskDto> pendingCareTasks) { this.pendingCareTasks = pendingCareTasks; }

    public List<TreatmentLabTestDto> getPendingLabTests() { return pendingLabTests; }
    public void setPendingLabTests(List<TreatmentLabTestDto> pendingLabTests) { this.pendingLabTests = pendingLabTests; }
}
