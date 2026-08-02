package com.app.ai.dto;

import java.util.UUID;
import java.time.LocalDateTime;

public class FollowUpCheckInResponse {
    private UUID id;
    private UUID followUpPlanId;
    private Integer dayNumber;
    private String responses;
    private String aiAnalysis;
    private String actionRecommended;
    private LocalDateTime createdAt;

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getFollowUpPlanId() { return followUpPlanId; }
    public void setFollowUpPlanId(UUID followUpPlanId) { this.followUpPlanId = followUpPlanId; }
    public Integer getDayNumber() { return dayNumber; }
    public void setDayNumber(Integer dayNumber) { this.dayNumber = dayNumber; }
    public String getResponses() { return responses; }
    public void setResponses(String responses) { this.responses = responses; }
    public String getAiAnalysis() { return aiAnalysis; }
    public void setAiAnalysis(String aiAnalysis) { this.aiAnalysis = aiAnalysis; }
    public String getActionRecommended() { return actionRecommended; }
    public void setActionRecommended(String actionRecommended) { this.actionRecommended = actionRecommended; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
