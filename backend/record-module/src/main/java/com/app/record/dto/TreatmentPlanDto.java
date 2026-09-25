package com.app.record.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class TreatmentPlanDto {
    private UUID id;
    private UUID patientId;
    private UUID doctorId;
    private String doctorName;
    private UUID appointmentId;
    private UUID medicalRecordId;
    private String title;
    private String diagnosis;
    private String instructions;
    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate followUpDate;
    private String status;
    private Integer totalMedications;
    private Integer totalTasks;
    private Integer completedTasks;
    private Double progressPercentage;
    private List<TreatmentMedicationDto> medications;
    private List<TreatmentLabTestDto> labTests;
    private List<CareTaskDto> tasks;
    private LocalDateTime createdAt;

    public TreatmentPlanDto() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public UUID getDoctorId() { return doctorId; }
    public void setDoctorId(UUID doctorId) { this.doctorId = doctorId; }

    public String getDoctorName() { return doctorName; }
    public void setDoctorName(String doctorName) { this.doctorName = doctorName; }

    public UUID getAppointmentId() { return appointmentId; }
    public void setAppointmentId(UUID appointmentId) { this.appointmentId = appointmentId; }

    public UUID getMedicalRecordId() { return medicalRecordId; }
    public void setMedicalRecordId(UUID medicalRecordId) { this.medicalRecordId = medicalRecordId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDiagnosis() { return diagnosis; }
    public void setDiagnosis(String diagnosis) { this.diagnosis = diagnosis; }

    public String getInstructions() { return instructions; }
    public void setInstructions(String instructions) { this.instructions = instructions; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public LocalDate getFollowUpDate() { return followUpDate; }
    public void setFollowUpDate(LocalDate followUpDate) { this.followUpDate = followUpDate; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getTotalMedications() { return totalMedications; }
    public void setTotalMedications(Integer totalMedications) { this.totalMedications = totalMedications; }

    public Integer getTotalTasks() { return totalTasks; }
    public void setTotalTasks(Integer totalTasks) { this.totalTasks = totalTasks; }

    public Integer getCompletedTasks() { return completedTasks; }
    public void setCompletedTasks(Integer completedTasks) { this.completedTasks = completedTasks; }

    public Double getProgressPercentage() { return progressPercentage; }
    public void setProgressPercentage(Double progressPercentage) { this.progressPercentage = progressPercentage; }

    public List<TreatmentMedicationDto> getMedications() { return medications; }
    public void setMedications(List<TreatmentMedicationDto> medications) { this.medications = medications; }

    public List<TreatmentLabTestDto> getLabTests() { return labTests; }
    public void setLabTests(List<TreatmentLabTestDto> labTests) { this.labTests = labTests; }

    public List<CareTaskDto> getTasks() { return tasks; }
    public void setTasks(List<CareTaskDto> tasks) { this.tasks = tasks; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
