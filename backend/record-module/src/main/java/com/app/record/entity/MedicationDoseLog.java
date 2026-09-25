package com.app.record.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "medication_dose_logs")
public class MedicationDoseLog extends BaseEntity {

    @Column(name = "treatment_medication_id", nullable = false)
    private UUID treatmentMedicationId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "dose_date", nullable = false)
    private LocalDate doseDate;

    @Column(name = "dose_slot", nullable = false)
    private String doseSlot; // MORNING, AFTERNOON, EVENING, NIGHT

    @Column(nullable = false)
    private String status = "SCHEDULED"; // SCHEDULED, TAKEN, SKIPPED, NOT_REPORTED

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "patient_note", columnDefinition = "TEXT")
    private String patientNote;

    public UUID getTreatmentMedicationId() {
        return treatmentMedicationId;
    }

    public void setTreatmentMedicationId(UUID treatmentMedicationId) {
        this.treatmentMedicationId = treatmentMedicationId;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public LocalDate getDoseDate() {
        return doseDate;
    }

    public void setDoseDate(LocalDate doseDate) {
        this.doseDate = doseDate;
    }

    public String getDoseSlot() {
        return doseSlot;
    }

    public void setDoseSlot(String doseSlot) {
        this.doseSlot = doseSlot;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getConfirmedAt() {
        return confirmedAt;
    }

    public void setConfirmedAt(LocalDateTime confirmedAt) {
        this.confirmedAt = confirmedAt;
    }

    public String getPatientNote() {
        return patientNote;
    }

    public void setPatientNote(String patientNote) {
        this.patientNote = patientNote;
    }
}
