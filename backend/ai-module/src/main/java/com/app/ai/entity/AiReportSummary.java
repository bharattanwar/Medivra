package com.app.ai.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "ai_report_summaries")
public class AiReportSummary extends BaseEntity {

    @Column(name = "report_id", nullable = false, unique = true)
    private UUID reportId;

    @Column(name = "summary_text", columnDefinition = "TEXT", nullable = false)
    private String summaryText;

    @Column(name = "abnormal_findings", columnDefinition = "TEXT")
    private String abnormalFindings;

    @Column(name = "normal_findings", columnDefinition = "TEXT")
    private String normalFindings;

    @Column(name = "suggested_questions", columnDefinition = "TEXT")
    private String suggestedQuestions;

    @Column(name = "recommended_follow_ups", columnDefinition = "TEXT")
    private String recommendedFollowUps;

    @Column(name = "confidence_level")
    private String confidenceLevel;

    @Column(name = "raw_ai_response", columnDefinition = "TEXT")
    private String rawAiResponse;

    public UUID getReportId() {
        return reportId;
    }

    public void setReportId(UUID reportId) {
        this.reportId = reportId;
    }

    public String getSummaryText() {
        return summaryText;
    }

    public void setSummaryText(String summaryText) {
        this.summaryText = summaryText;
    }

    public String getAbnormalFindings() {
        return abnormalFindings;
    }

    public void setAbnormalFindings(String abnormalFindings) {
        this.abnormalFindings = abnormalFindings;
    }

    public String getNormalFindings() {
        return normalFindings;
    }

    public void setNormalFindings(String normalFindings) {
        this.normalFindings = normalFindings;
    }

    public String getSuggestedQuestions() {
        return suggestedQuestions;
    }

    public void setSuggestedQuestions(String suggestedQuestions) {
        this.suggestedQuestions = suggestedQuestions;
    }

    public String getRecommendedFollowUps() {
        return recommendedFollowUps;
    }

    public void setRecommendedFollowUps(String recommendedFollowUps) {
        this.recommendedFollowUps = recommendedFollowUps;
    }

    public String getConfidenceLevel() {
        return confidenceLevel;
    }

    public void setConfidenceLevel(String confidenceLevel) {
        this.confidenceLevel = confidenceLevel;
    }

    public String getRawAiResponse() {
        return rawAiResponse;
    }

    public void setRawAiResponse(String rawAiResponse) {
        this.rawAiResponse = rawAiResponse;
    }
}
