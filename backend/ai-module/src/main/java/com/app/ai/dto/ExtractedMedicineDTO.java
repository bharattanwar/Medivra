package com.app.ai.dto;

import java.util.UUID;

public class ExtractedMedicineDTO {
    private String extractedName;
    private UUID matchedMedicineId;
    private String matchedMedicineName;
    private Integer confidenceScore; // 0-100
    private String dosage;
    private String frequency;
    private String duration;
    private Integer quantity;

    public String getExtractedName() {
        return extractedName;
    }

    public void setExtractedName(String extractedName) {
        this.extractedName = extractedName;
    }

    public UUID getMatchedMedicineId() {
        return matchedMedicineId;
    }

    public void setMatchedMedicineId(UUID matchedMedicineId) {
        this.matchedMedicineId = matchedMedicineId;
    }

    public String getMatchedMedicineName() {
        return matchedMedicineName;
    }

    public void setMatchedMedicineName(String matchedMedicineName) {
        this.matchedMedicineName = matchedMedicineName;
    }

    public Integer getConfidenceScore() {
        return confidenceScore;
    }

    public void setConfidenceScore(Integer confidenceScore) {
        this.confidenceScore = confidenceScore;
    }

    public String getDosage() {
        return dosage;
    }

    public void setDosage(String dosage) {
        this.dosage = dosage;
    }

    public String getFrequency() {
        return frequency;
    }

    public void setFrequency(String frequency) {
        this.frequency = frequency;
    }

    public String getDuration() {
        return duration;
    }

    public void setDuration(String duration) {
        this.duration = duration;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }
}
