package com.app.record.dto;

import java.util.UUID;

public class AiContextQuestionRequest {
    private UUID patientId;
    private String question;

    public AiContextQuestionRequest() {}

    public AiContextQuestionRequest(UUID patientId, String question) {
        this.patientId = patientId;
        this.question = question;
    }

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }
}
