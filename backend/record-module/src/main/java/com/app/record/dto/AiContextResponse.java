package com.app.record.dto;

import java.util.List;

public class AiContextResponse {
    private String answer;
    private String contextSummary;
    private List<String> sourceRecords;
    private List<String> suggestedNextQuestions;

    public AiContextResponse() {}

    public AiContextResponse(String answer, String contextSummary, List<String> sourceRecords, List<String> suggestedNextQuestions) {
        this.answer = answer;
        this.contextSummary = contextSummary;
        this.sourceRecords = sourceRecords;
        this.suggestedNextQuestions = suggestedNextQuestions;
    }

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }

    public String getContextSummary() { return contextSummary; }
    public void setContextSummary(String contextSummary) { this.contextSummary = contextSummary; }

    public List<String> getSourceRecords() { return sourceRecords; }
    public void setSourceRecords(List<String> sourceRecords) { this.sourceRecords = sourceRecords; }

    public List<String> getSuggestedNextQuestions() { return suggestedNextQuestions; }
    public void setSuggestedNextQuestions(List<String> suggestedNextQuestions) { this.suggestedNextQuestions = suggestedNextQuestions; }
}
