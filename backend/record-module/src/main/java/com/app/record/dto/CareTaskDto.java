package com.app.record.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class CareTaskDto {
    private UUID id;
    private UUID patientId;
    private UUID treatmentPlanId;
    private String taskType;
    private String title;
    private String description;
    private LocalDate dueDate;
    private String dueTimeSlot;
    private String priority;
    private String status;
    private UUID referenceId;
    private LocalDateTime completedAt;

    public CareTaskDto() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public UUID getTreatmentPlanId() { return treatmentPlanId; }
    public void setTreatmentPlanId(UUID treatmentPlanId) { this.treatmentPlanId = treatmentPlanId; }

    public String getTaskType() { return taskType; }
    public void setTaskType(String taskType) { this.taskType = taskType; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public String getDueTimeSlot() { return dueTimeSlot; }
    public void setDueTimeSlot(String dueTimeSlot) { this.dueTimeSlot = dueTimeSlot; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public UUID getReferenceId() { return referenceId; }
    public void setReferenceId(UUID referenceId) { this.referenceId = referenceId; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}
