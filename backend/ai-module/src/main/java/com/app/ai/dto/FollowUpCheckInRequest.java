package com.app.ai.dto;

import java.util.UUID;
import java.util.Map;

public class FollowUpCheckInRequest {
    private UUID planId;
    private Integer dayNumber;
    private Map<String, String> responses;

    // Getters and Setters
    public UUID getPlanId() { return planId; }
    public void setPlanId(UUID planId) { this.planId = planId; }
    public Integer getDayNumber() { return dayNumber; }
    public void setDayNumber(Integer dayNumber) { this.dayNumber = dayNumber; }
    public Map<String, String> getResponses() { return responses; }
    public void setResponses(Map<String, String> responses) { this.responses = responses; }
}
