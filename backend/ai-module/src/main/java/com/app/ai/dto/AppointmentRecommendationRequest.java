package com.app.ai.dto;

import java.util.UUID;
import java.util.Map;

public class AppointmentRecommendationRequest {
    private UUID patientId;
    private String symptoms;
    private Map<String, String> preferences; // e.g. language, budget, gender, distance, insurance, mode

    // Getters and Setters
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public String getSymptoms() { return symptoms; }
    public void setSymptoms(String symptoms) { this.symptoms = symptoms; }
    public Map<String, String> getPreferences() { return preferences; }
    public void setPreferences(Map<String, String> preferences) { this.preferences = preferences; }
}
