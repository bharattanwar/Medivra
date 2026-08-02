package com.app.ai.dto;

import java.util.UUID;

public class FollowUpProgressResponse {
    private UUID planId;
    private String overallProgressSummary;
    private Double adherencePercentage;
    private String recoveryTrend; // e.g. IMPROVING, WORSENING, STABLE

    // Getters and Setters
    public UUID getPlanId() { return planId; }
    public void setPlanId(UUID planId) { this.planId = planId; }
    public String getOverallProgressSummary() { return overallProgressSummary; }
    public void setOverallProgressSummary(String overallProgressSummary) { this.overallProgressSummary = overallProgressSummary; }
    public Double getAdherencePercentage() { return adherencePercentage; }
    public void setAdherencePercentage(Double adherencePercentage) { this.adherencePercentage = adherencePercentage; }
    public String getRecoveryTrend() { return recoveryTrend; }
    public void setRecoveryTrend(String recoveryTrend) { this.recoveryTrend = recoveryTrend; }
}
