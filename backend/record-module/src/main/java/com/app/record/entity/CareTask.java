package com.app.record.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "care_tasks")
public class CareTask extends BaseEntity {

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "treatment_plan_id")
    private UUID treatmentPlanId;

    @Column(name = "task_type", nullable = false)
    private String taskType; // MEDICATION_DOSE, LAB_TEST, REPORT_UPLOAD, FOLLOW_UP_CONSULTATION, DAILY_CHECK_IN

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(name = "due_time_slot")
    private String dueTimeSlot = "ANYTIME"; // MORNING, AFTERNOON, EVENING, NIGHT, ANYTIME

    @Column(nullable = false)
    private String priority = "MEDIUM"; // HIGH, MEDIUM, LOW

    @Column(nullable = false)
    private String status = "PENDING"; // PENDING, IN_PROGRESS, COMPLETED, SKIPPED, OVERDUE

    @Column(name = "reference_id")
    private UUID referenceId;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public UUID getPatientId() {
        return patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public UUID getTreatmentPlanId() {
        return treatmentPlanId;
    }

    public void setTreatmentPlanId(UUID treatmentPlanId) {
        this.treatmentPlanId = treatmentPlanId;
    }

    public String getTaskType() {
        return taskType;
    }

    public void setTaskType(String taskType) {
        this.taskType = taskType;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public String getDueTimeSlot() {
        return dueTimeSlot;
    }

    public void setDueTimeSlot(String dueTimeSlot) {
        this.dueTimeSlot = dueTimeSlot;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UUID getReferenceId() {
        return referenceId;
    }

    public void setReferenceId(UUID referenceId) {
        this.referenceId = referenceId;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }
}
