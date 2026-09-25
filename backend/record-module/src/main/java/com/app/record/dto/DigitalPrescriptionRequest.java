package com.app.record.dto;

import java.util.List;
import java.util.UUID;

public class DigitalPrescriptionRequest {
    private UUID appointmentId;
    private UUID doctorId;
    private UUID patientId;
    private String diagnosis;
    private String notes;
    private List<PrescriptionMedicine> medicines;
    private List<String> labTests;
    private Integer followUpDays;

    public DigitalPrescriptionRequest() {}

    public UUID getAppointmentId() { return appointmentId; }
    public void setAppointmentId(UUID appointmentId) { this.appointmentId = appointmentId; }

    public UUID getDoctorId() { return doctorId; }
    public void setDoctorId(UUID doctorId) { this.doctorId = doctorId; }

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public String getDiagnosis() { return diagnosis; }
    public void setDiagnosis(String diagnosis) { this.diagnosis = diagnosis; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public List<PrescriptionMedicine> getMedicines() { return medicines; }
    public void setMedicines(List<PrescriptionMedicine> medicines) { this.medicines = medicines; }

    public List<String> getLabTests() { return labTests; }
    public void setLabTests(List<String> labTests) { this.labTests = labTests; }

    public Integer getFollowUpDays() { return followUpDays; }
    public void setFollowUpDays(Integer followUpDays) { this.followUpDays = followUpDays; }
}
