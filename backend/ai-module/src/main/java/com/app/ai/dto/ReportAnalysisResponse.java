package com.app.ai.dto;

import java.util.UUID;
import java.time.LocalDateTime;

public class ReportAnalysisResponse {
    private UUID reportId;
    private UUID patientId;
    private String reportType;
    private String summaryText;
    private String abnormalFindings;
    private String normalFindings;
    private String suggestedQuestions;
    private String recommendedFollowUps;
    private String confidenceLevel;
    private LocalDateTime analyzedAt;

    // Getters and Setters
    public UUID getReportId() { return reportId; }
    public void setReportId(UUID reportId) { this.reportId = reportId; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public String getReportType() { return reportType; }
    public void setReportType(String reportType) { this.reportType = reportType; }
    public String getSummaryText() { return summaryText; }
    public void setSummaryText(String summaryText) { this.summaryText = summaryText; }
    public String getAbnormalFindings() { return abnormalFindings; }
    public void setAbnormalFindings(String abnormalFindings) { this.abnormalFindings = abnormalFindings; }
    public String getNormalFindings() { return normalFindings; }
    public void setNormalFindings(String normalFindings) { this.normalFindings = normalFindings; }
    public String getSuggestedQuestions() { return suggestedQuestions; }
    public void setSuggestedQuestions(String suggestedQuestions) { this.suggestedQuestions = suggestedQuestions; }
    public String getRecommendedFollowUps() { return recommendedFollowUps; }
    public void setRecommendedFollowUps(String recommendedFollowUps) { this.recommendedFollowUps = recommendedFollowUps; }
    public String getConfidenceLevel() { return confidenceLevel; }
    public void setConfidenceLevel(String confidenceLevel) { this.confidenceLevel = confidenceLevel; }
    public LocalDateTime getAnalyzedAt() { return analyzedAt; }
    public void setAnalyzedAt(LocalDateTime analyzedAt) { this.analyzedAt = analyzedAt; }
}
