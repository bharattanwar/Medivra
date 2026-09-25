package com.app.ai.dto;

import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;

public class ReportAnalysisRequest {
    private UUID patientId;
    private String reportType;
    private MultipartFile file;
    private Boolean isHealthJourneyFulfillment;
    private UUID linkedLabTestId;
    private UUID linkedTaskId;

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public String getReportType() { return reportType; }
    public void setReportType(String reportType) { this.reportType = reportType; }
    public MultipartFile getFile() { return file; }
    public void setFile(MultipartFile file) { this.file = file; }

    public Boolean getIsHealthJourneyFulfillment() { return isHealthJourneyFulfillment; }
    public void setIsHealthJourneyFulfillment(Boolean isHealthJourneyFulfillment) { this.isHealthJourneyFulfillment = isHealthJourneyFulfillment; }

    public UUID getLinkedLabTestId() { return linkedLabTestId; }
    public void setLinkedLabTestId(UUID linkedLabTestId) { this.linkedLabTestId = linkedLabTestId; }

    public UUID getLinkedTaskId() { return linkedTaskId; }
    public void setLinkedTaskId(UUID linkedTaskId) { this.linkedTaskId = linkedTaskId; }
}
