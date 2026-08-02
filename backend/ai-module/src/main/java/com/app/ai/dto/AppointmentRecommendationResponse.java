package com.app.ai.dto;

import java.util.UUID;
import java.time.LocalDateTime;

public class AppointmentRecommendationResponse {
    private UUID id;
    private UUID patientId;
    private String recommendedSpecialty;
    private String urgencyLevel;
    private String rankedDoctors; // JSON String
    private String aiExplanation;
    private LocalDateTime createdAt;

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public String getRecommendedSpecialty() { return recommendedSpecialty; }
    public void setRecommendedSpecialty(String recommendedSpecialty) { this.recommendedSpecialty = recommendedSpecialty; }
    public String getUrgencyLevel() { return urgencyLevel; }
    public void setUrgencyLevel(String urgencyLevel) { this.urgencyLevel = urgencyLevel; }
    public String getRankedDoctors() { return rankedDoctors; }
    public void setRankedDoctors(String rankedDoctors) { this.rankedDoctors = rankedDoctors; }
    public String getAiExplanation() { return aiExplanation; }
    public void setAiExplanation(String aiExplanation) { this.aiExplanation = aiExplanation; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
