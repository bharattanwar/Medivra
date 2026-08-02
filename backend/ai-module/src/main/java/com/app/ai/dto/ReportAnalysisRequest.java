package com.app.ai.dto;

import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;

public class ReportAnalysisRequest {
    private UUID patientId;
    private String reportType;
    private MultipartFile file;

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public String getReportType() { return reportType; }
    public void setReportType(String reportType) { this.reportType = reportType; }
    public MultipartFile getFile() { return file; }
    public void setFile(MultipartFile file) { this.file = file; }
}
