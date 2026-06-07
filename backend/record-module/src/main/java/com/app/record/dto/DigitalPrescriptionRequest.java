package com.app.record.dto;

import java.util.List;
import java.util.UUID;

public class DigitalPrescriptionRequest {
    private UUID appointmentId;
    private UUID doctorId;
    private UUID patientId;
    private String notes;
    private List<PrescriptionMedicine> medicines;

    public DigitalPrescriptionRequest() {}

    public UUID getAppointmentId() { return appointmentId; }
    public void setAppointmentId(UUID appointmentId) { this.appointmentId = appointmentId; }

    public UUID getDoctorId() { return doctorId; }
    public void setDoctorId(UUID doctorId) { this.doctorId = doctorId; }

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public List<PrescriptionMedicine> getMedicines() { return medicines; }
    public void setMedicines(List<PrescriptionMedicine> medicines) { this.medicines = medicines; }
}
