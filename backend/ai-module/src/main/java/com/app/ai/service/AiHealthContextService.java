package com.app.ai.service;

import com.app.record.dto.*;
import com.app.record.service.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class AiHealthContextService {

    private static final Logger log = LoggerFactory.getLogger(AiHealthContextService.class);

    private final GeminiService geminiService;
    private final TreatmentPlanService treatmentPlanService;
    private final NextActionService nextActionService;
    private final DeterministicLabService deterministicLabService;
    private final DoctorBriefService doctorBriefService;

    public AiHealthContextService(GeminiService geminiService,
                                  TreatmentPlanService treatmentPlanService,
                                  NextActionService nextActionService,
                                  DeterministicLabService deterministicLabService,
                                  DoctorBriefService doctorBriefService) {
        this.geminiService = geminiService;
        this.treatmentPlanService = treatmentPlanService;
        this.nextActionService = nextActionService;
        this.deterministicLabService = deterministicLabService;
        this.doctorBriefService = doctorBriefService;
    }

    /**
     * Answers patient health journey questions with strict non-diagnostic context grounding.
     */
    public AiContextResponse answerPatientQuestion(UUID patientId, String question) {
        log.info("Answering patient health context question for {}", patientId);

        // 1. Gather Structured Journey Context
        NextActionResponse nextActions = nextActionService.getNextActionsForPatient(patientId);
        List<LabTrendResponse> labTrends = deterministicLabService.getLabTrendsForPatient(patientId);
        DoctorBriefResponse brief = doctorBriefService.generateBrief(patientId);

        StringBuilder contextBuilder = new StringBuilder();
        contextBuilder.append("=== PATIENT STRUCTURED HEALTH JOURNEY CONTEXT ===\n");

        if (nextActions.getActivePlan() != null) {
            TreatmentPlanDto plan = nextActions.getActivePlan();
            contextBuilder.append("Active Diagnosis: ").append(plan.getDiagnosis()).append("\n");
            contextBuilder.append("Treatment Title: ").append(plan.getTitle()).append("\n");
            contextBuilder.append("Duration: ").append(plan.getStartDate()).append(" to ").append(plan.getEndDate()).append("\n");
            contextBuilder.append("Prescribed Doctor: ").append(plan.getDoctorName()).append("\n");
            contextBuilder.append("Doctor Instructions: ").append(plan.getInstructions()).append("\n");
            if (plan.getMedications() != null) {
                contextBuilder.append("Medications:\n");
                for (TreatmentMedicationDto m : plan.getMedications()) {
                    contextBuilder.append(" - ").append(m.getMedicineName()).append(" (").append(m.getDosage())
                            .append(", ").append(m.getFrequency()).append(", ").append(m.getTotalDays()).append(" days)\n");
                }
            }
        } else {
            contextBuilder.append("No currently active treatment plan.\n");
        }

        contextBuilder.append("\nToday's Scheduled Doses: ").append(nextActions.getTotalDosesToday())
                .append(" total, ").append(nextActions.getTakenDosesToday()).append(" confirmed taken.\n");

        if (nextActions.getTodayTasks() != null && !nextActions.getTodayTasks().isEmpty()) {
            contextBuilder.append("Today's Tasks: ");
            for (CareTaskDto t : nextActions.getTodayTasks()) {
                contextBuilder.append(t.getTitle()).append(" (").append(t.getStatus()).append("); ");
            }
            contextBuilder.append("\n");
        }

        if (nextActions.getNextTasks() != null && !nextActions.getNextTasks().isEmpty()) {
            contextBuilder.append("Upcoming Care Tasks: ");
            for (CareTaskDto t : nextActions.getNextTasks()) {
                contextBuilder.append(t.getTitle()).append(" due ").append(t.getDueDate()).append("; ");
            }
            contextBuilder.append("\n");
        }

        if (nextActions.getPendingLabTests() != null && !nextActions.getPendingLabTests().isEmpty()) {
            contextBuilder.append("Prescribed Lab Tests to Take: ");
            for (TreatmentLabTestDto t : nextActions.getPendingLabTests()) {
                contextBuilder.append(t.getTestName()).append(" (due ").append(t.getDueDate()).append("); ");
            }
            contextBuilder.append("\n");
        }

        if (nextActions.getNextFollowUpRecommendation() != null) {
            contextBuilder.append("Follow-up Recommendation: ").append(nextActions.getNextFollowUpRecommendation()).append("\n");
        }

        if (labTrends != null && !labTrends.isEmpty()) {
            contextBuilder.append("\nDeterministic Lab Parameter Results & Trends:\n");
            for (LabTrendResponse trend : labTrends) {
                contextBuilder.append(" - ").append(trend.getParameterName()).append(": Latest = ").append(trend.getLatestRawValue())
                        .append(" ").append(trend.getUnit() != null ? trend.getUnit() : "")
                        .append(" (Ref Range: ").append(trend.getReferenceRangeText() != null ? trend.getReferenceRangeText() : "N/A").append(")")
                        .append(", Status: ").append(trend.getLatestFlag());
                if (trend.getPreviousValue() != null) {
                    contextBuilder.append(", Previous = ").append(trend.getPreviousRawValue())
                            .append(", Trend = ").append(trend.getTrendDirection())
                            .append(" (").append(trend.getDeltaPercentage() != null ? trend.getDeltaPercentage() + "%" : "").append(")");
                }
                contextBuilder.append("\n");
            }
        }

        if (brief.getLastDoctorNotes() != null) {
            contextBuilder.append("\nLast Doctor Notes: ").append(brief.getLastDoctorNotes()).append("\n");
        }

        String systemPrompt = """
                You are Medivra's AI Health Journey Navigator.
                Your role is strictly to EXPLAIN, SUMMARIZE, and CLARIFY the structured health journey information that Medivra already knows for this patient.

                STRICT CLINICAL SAFETY RULES:
                1. DO NOT diagnose diseases or suggest potential medical conditions.
                2. DO NOT prescribe medications, adjust dosages, or recommend stopping/starting medicines.
                3. Base all your answers strictly on the verified facts in the PATIENT CONTEXT above.
                4. Always maintain an empathetic, clear, and reassuring tone.
                5. Format clearly with bullet points and bold highlights where appropriate.
                6. Remind the patient to follow their doctor's explicit instructions.
                """;

        String prompt = systemPrompt + "\n\n" + contextBuilder.toString() + "\n\nPATIENT QUESTION: " + question;

        String answer;
        try {
            answer = geminiService.analyzeText(prompt, "HEALTH_JOURNEY_CONTEXT", patientId);
        } catch (Exception e) {
            log.error("AI Generation error: {}", e.getMessage());
            answer = "I have reviewed your active health journey. Based on your records, your current treatment plan is for **" +
                    (brief.getActiveDiagnosis() != null ? brief.getActiveDiagnosis() : "your condition") +
                    "**. You have " + (nextActions.getTodayTasks() != null ? nextActions.getTodayTasks().size() : 0) + " tasks due today and " +
                    (nextActions.getPendingLabTests() != null ? nextActions.getPendingLabTests().size() : 0) + " lab tests scheduled. Please check your Next Actions tab for immediate steps.";
        }

        List<String> sources = new ArrayList<>();
        if (nextActions.getActivePlan() != null) sources.add("Active Treatment Plan: " + nextActions.getActivePlan().getTitle());
        if (!labTrends.isEmpty()) sources.add("Lab Report History (" + labTrends.size() + " parameters)");
        if (brief.getLastConsultationDate() != null) sources.add("Consultation on " + brief.getLastConsultationDate());

        List<String> suggestions = Arrays.asList(
                "What medicines do I have to take today?",
                "Explain my latest lab test results",
                "What diagnostic tests are coming up next?",
                "When should I schedule my follow-up review?"
        );

        return new AiContextResponse(answer, "Contextual summary grounded in your active Medivra medical records.", sources, suggestions);
    }
}
