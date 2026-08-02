package com.app.ai.dto;

import java.util.UUID;
import java.util.List;
import java.util.Map;

public class FollowUpPlanRequest {
    private UUID appointmentId;
    private UUID patientId;
    private UUID doctorId;
    private String diagnosis;
    private List<Map<String, String>> medicines; // e.g., [{"name": "Para", "dosage": "500mg"}]
    private Integer followUpIntervalDays;

    // Getters and Setters
    public UUID getAppointmentId() { return appointmentId; }
    public void setAppointmentId(UUID appointmentId) { this.appointmentId = appointmentId; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public UUID getDoctorId() { return doctorId; }
    public void setDoctorId(UUID doctorId) { this.doctorId = doctorId; }
    public String getDiagnosis() { return diagnosis; }
    public void setDiagnosis(String diagnosis) { this.diagnosis = diagnosis; }
    public List<Map<String, String>> getMedicines() { return medicines; }
    public void setMedicines(List<Map<String, String>> medicines) { this.medicines = medicines; }
    public Integer getFollowUpIntervalDays() { return followUpIntervalDays; }
    public void setFollowUpIntervalDays(Integer followUpIntervalDays) { this.followUpIntervalDays = followUpIntervalDays; }
}
