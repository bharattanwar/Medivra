package com.app.record.dto;

import java.time.LocalDate;
import java.util.UUID;

public class TreatmentLabTestDto {
    private UUID id;
    private UUID treatmentPlanId;
    private UUID patientId;
    private String testName;
    private String urgency;
    private LocalDate dueDate;
    private String instructions;
    private String status;
    private UUID reportId;

    public TreatmentLabTestDto() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTreatmentPlanId() { return treatmentPlanId; }
    public void setTreatmentPlanId(UUID treatmentPlanId) { this.treatmentPlanId = treatmentPlanId; }

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public String getTestName() { return testName; }
    public void setTestName(String testName) { this.testName = testName; }

    public String getUrgency() { return urgency; }
    public void setUrgency(String urgency) { this.urgency = urgency; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public String getInstructions() { return instructions; }
    public void setInstructions(String instructions) { this.instructions = instructions; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public UUID getReportId() { return reportId; }
    public void setReportId(UUID reportId) { this.reportId = reportId; }
}
