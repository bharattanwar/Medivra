package com.app.ai.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "follow_up_check_ins")
public class FollowUpCheckIn extends BaseEntity {

    @Column(name = "follow_up_plan_id", nullable = false)
    private UUID followUpPlanId;

    @Column(name = "day_number", nullable = false)
    private Integer dayNumber;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String responses; // JSON Map of answers

    @Column(name = "ai_analysis", columnDefinition = "TEXT")
    private String aiAnalysis;

    @Column(name = "action_recommended")
    private String actionRecommended; // CONTINUE, BOOK_FOLLOWUP, CONTACT_DOCTOR, EMERGENCY

    public UUID getFollowUpPlanId() {
        return followUpPlanId;
    }

    public void setFollowUpPlanId(UUID followUpPlanId) {
        this.followUpPlanId = followUpPlanId;
    }

    public Integer getDayNumber() {
        return dayNumber;
    }

    public void setDayNumber(Integer dayNumber) {
        this.dayNumber = dayNumber;
    }

    public String getResponses() {
        return responses;
    }

    public void setResponses(String responses) {
        this.responses = responses;
    }

    public String getAiAnalysis() {
        return aiAnalysis;
    }

    public void setAiAnalysis(String aiAnalysis) {
        this.aiAnalysis = aiAnalysis;
    }

    public String getActionRecommended() {
        return actionRecommended;
    }

    public void setActionRecommended(String actionRecommended) {
        this.actionRecommended = actionRecommended;
    }
}
