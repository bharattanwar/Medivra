package com.app.pharmacy.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "refill_reminders")
public class RefillReminder extends BaseEntity {

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "medicine_name", nullable = false)
    private String medicineName;

    @Column(name = "next_refill_date", nullable = false)
    private LocalDate nextRefillDate;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    public UUID getPatientId() {
        return patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public String getMedicineName() {
        return medicineName;
    }

    public void setMedicineName(String medicineName) {
        this.medicineName = medicineName;
    }

    public LocalDate getNextRefillDate() {
        return nextRefillDate;
    }

    public void setNextRefillDate(LocalDate nextRefillDate) {
        this.nextRefillDate = nextRefillDate;
    }

    public Boolean getActive() {
        return isActive;
    }

    public void setActive(Boolean active) {
        isActive = active;
    }
}
