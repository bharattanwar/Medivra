package com.app.record.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "treatment_lab_tests")
public class TreatmentLabTest extends BaseEntity {

    @Column(name = "treatment_plan_id", nullable = false)
    private UUID treatmentPlanId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "test_name", nullable = false)
    private String testName;

    @Column(nullable = false)
    private String urgency = "ROUTINE"; // ROUTINE, URGENT, PRIORITY

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    @Column(nullable = false)
    private String status = "PENDING"; // PENDING, ORDERED, COMPLETED, CANCELLED

    @Column(name = "report_id")
    private UUID reportId;

    public UUID getTreatmentPlanId() {
        return treatmentPlanId;
    }

    public void setTreatmentPlanId(UUID treatmentPlanId) {
        this.treatmentPlanId = treatmentPlanId;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public String getTestName() {
        return testName;
    }

    public void setTestName(String testName) {
        this.testName = testName;
    }

    public String getUrgency() {
        return urgency;
    }

    public void setUrgency(String urgency) {
        this.urgency = urgency;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public String getInstructions() {
        return instructions;
    }

    public void setInstructions(String instructions) {
        this.instructions = instructions;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UUID getReportId() {
        return reportId;
    }

    public void setReportId(UUID reportId) {
        this.reportId = reportId;
    }
}
