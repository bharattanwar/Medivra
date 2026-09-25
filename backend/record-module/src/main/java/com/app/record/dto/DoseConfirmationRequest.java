package com.app.record.dto;

public class DoseConfirmationRequest {
    private String status; // TAKEN, SKIPPED
    private String patientNote;

    public DoseConfirmationRequest() {}

    public DoseConfirmationRequest(String status, String patientNote) {
        this.status = status;
        this.patientNote = patientNote;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPatientNote() { return patientNote; }
    public void setPatientNote(String patientNote) { this.patientNote = patientNote; }
}
