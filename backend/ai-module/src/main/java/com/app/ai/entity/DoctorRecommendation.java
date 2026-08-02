package com.app.ai.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "doctor_recommendations")
public class DoctorRecommendation extends BaseEntity {

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String symptoms;

    @Column(columnDefinition = "TEXT")
    private String preferences; // JSON of language, budget, gender, distance, insurance, mode

    @Column(name = "recommended_specialty", nullable = false)
    private String recommendedSpecialty;

    @Column(name = "urgency_level", nullable = false)
    private String urgencyLevel;

    @Column(name = "ranked_doctors", columnDefinition = "TEXT", nullable = false)
    private String rankedDoctors; // JSON array of doctor objects with AI explanations

    @Column(name = "ai_explanation", columnDefinition = "TEXT")
    private String aiExplanation;

    public UUID getPatientId() {
        return patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public String getSymptoms() {
        return symptoms;
    }

    public void setSymptoms(String symptoms) {
        this.symptoms = symptoms;
    }

    public String getPreferences() {
        return preferences;
    }

    public void setPreferences(String preferences) {
        this.preferences = preferences;
    }

    public String getRecommendedSpecialty() {
        return recommendedSpecialty;
    }

    public void setRecommendedSpecialty(String recommendedSpecialty) {
        this.recommendedSpecialty = recommendedSpecialty;
    }

    public String getUrgencyLevel() {
        return urgencyLevel;
    }

    public void setUrgencyLevel(String urgencyLevel) {
        this.urgencyLevel = urgencyLevel;
    }

    public String getRankedDoctors() {
        return rankedDoctors;
    }

    public void setRankedDoctors(String rankedDoctors) {
        this.rankedDoctors = rankedDoctors;
    }

    public String getAiExplanation() {
        return aiExplanation;
    }

    public void setAiExplanation(String aiExplanation) {
        this.aiExplanation = aiExplanation;
    }
}
