package com.app.record.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class MedicationDoseLogDto {
    private UUID id;
    private UUID treatmentMedicationId;
    private String medicineName;
    private String dosage;
    private UUID patientId;
    private LocalDate doseDate;
    private String doseSlot;
    private String status;
    private LocalDateTime confirmedAt;
    private String patientNote;

    public MedicationDoseLogDto() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTreatmentMedicationId() { return treatmentMedicationId; }
    public void setTreatmentMedicationId(UUID treatmentMedicationId) { this.treatmentMedicationId = treatmentMedicationId; }

    public String getMedicineName() { return medicineName; }
    public void setMedicineName(String medicineName) { this.medicineName = medicineName; }

    public String getDosage() { return dosage; }
    public void setDosage(String dosage) { this.dosage = dosage; }

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public LocalDate getDoseDate() { return doseDate; }
    public void setDoseDate(LocalDate doseDate) { this.doseDate = doseDate; }

    public String getDoseSlot() { return doseSlot; }
    public void setDoseSlot(String doseSlot) { this.doseSlot = doseSlot; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(LocalDateTime confirmedAt) { this.confirmedAt = confirmedAt; }

    public String getPatientNote() { return patientNote; }
    public void setPatientNote(String patientNote) { this.patientNote = patientNote; }
}
