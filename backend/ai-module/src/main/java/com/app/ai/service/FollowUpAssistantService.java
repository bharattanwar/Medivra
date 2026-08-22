package com.app.ai.service;

import com.app.ai.dto.FollowUpCheckInRequest;
import com.app.ai.dto.FollowUpCheckInResponse;
import com.app.ai.dto.FollowUpPlanRequest;
import com.app.ai.dto.FollowUpProgressResponse;
import com.app.ai.entity.FollowUpCheckIn;
import com.app.ai.entity.FollowUpPlan;
import com.app.ai.repository.FollowUpCheckInRepository;
import com.app.ai.repository.FollowUpPlanRepository;
import com.app.common.entity.NotificationType;
import com.app.common.event.NotificationEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Manages the AI-driven post-consultation follow-up system.
 *
 * Doctors create a FollowUpPlan after a consultation, specifying diagnosis,
 * prescribed medicines, and how many days the patient should be monitored.
 *
 * Every day at 9 AM a scheduled job reminds active patients to submit a check-in.
 * Each check-in is analysed by Gemini, which recommends one of:
 *   - CONTINUE         → recovery on track, keep going
 *   - BOOK_FOLLOWUP    → patient should book a new appointment
 *   - CONTACT_DOCTOR   → something needs the doctor's attention today
 *   - EMERGENCY        → patient needs immediate care
 *
 * If the action is anything other than CONTINUE, the plan is escalated
 * and the doctor receives an in-app notification.
 */
@Service
public class FollowUpAssistantService {

    private final FollowUpPlanRepository planRepository;
    private final FollowUpCheckInRepository checkInRepository;
    private final GeminiService geminiService;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    public FollowUpAssistantService(FollowUpPlanRepository planRepository,
                                    FollowUpCheckInRepository checkInRepository,
                                    GeminiService geminiService,
                                    ApplicationEventPublisher eventPublisher) {
        this.planRepository = planRepository;
        this.checkInRepository = checkInRepository;
        this.geminiService = geminiService;
        this.eventPublisher = eventPublisher;
        this.objectMapper = new ObjectMapper();
    }

    /** Create a follow-up plan for a patient after a consultation. */
    @Transactional
    public FollowUpPlan createPlan(FollowUpPlanRequest request) {
        FollowUpPlan plan = new FollowUpPlan();
        plan.setAppointmentId(request.getAppointmentId());
        plan.setPatientId(request.getPatientId());
        plan.setDoctorId(request.getDoctorId());
        plan.setDiagnosis(request.getDiagnosis());

        try {
            plan.setMedicines(objectMapper.writeValueAsString(request.getMedicines()));
        } catch (Exception e) {
            plan.setMedicines("[]");
        }

        plan.setFollowUpIntervalDays(request.getFollowUpIntervalDays());
        plan.setStartDate(LocalDate.now());
        plan.setEndDate(LocalDate.now().plusDays(request.getFollowUpIntervalDays()));
        plan.setStatus("ACTIVE");
        plan = planRepository.save(plan);

        // Notify patient that monitoring has started
        eventPublisher.publishEvent(new NotificationEvent(
                this,
                request.getPatientId(),
                "Follow-up Plan Created",
                "Your doctor has created a follow-up plan for your recovery. "
                        + "We will check in with you daily.",
                NotificationType.SYSTEM,
                plan.getId().toString()
        ));

        return plan;
    }

    public FollowUpPlan getPlan(UUID planId) {
        return planRepository.findById(planId)
                .orElseThrow(() -> new RuntimeException("Plan not found: " + planId));
    }

    public List<FollowUpPlan> getPlansByPatient(UUID patientId) {
        return planRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    /**
     * Process a daily check-in from the patient.
     * Sends the patient's responses + previous history to Gemini and
     * stores the AI analysis alongside the check-in record.
     */
    @Transactional
    public FollowUpCheckInResponse processCheckIn(FollowUpCheckInRequest request) {
        FollowUpPlan plan = getPlan(request.getPlanId());
        List<FollowUpCheckIn> previousCheckIns =
                checkInRepository.findByFollowUpPlanIdOrderByDayNumberAsc(plan.getId());

        // Build context string so Gemini understands the patient's recovery arc
        StringBuilder context = new StringBuilder();
        context.append("Diagnosis: ").append(plan.getDiagnosis()).append("\n");
        context.append("Medicines: ").append(plan.getMedicines()).append("\n");
        context.append("Current Day: ").append(request.getDayNumber())
               .append(" out of ").append(plan.getFollowUpIntervalDays()).append("\n");
        context.append("Previous check-ins:\n");
        for (FollowUpCheckIn prev : previousCheckIns) {
            context.append("Day ").append(prev.getDayNumber())
                   .append(": ").append(prev.getResponses()).append("\n");
        }
        context.append("\nToday's check-in responses:\n");
        request.getResponses().forEach(
                (k, v) -> context.append(k).append(": ").append(v).append("\n"));

        String prompt = "You are an AI Follow-up Monitor tracking a patient's recovery.\n"
                + context
                + "\nEvaluate the patient's recovery progress, symptom worsening, "
                + "and medication adherence.\n";

        String schema = "{\n"
                + "  \"aiAnalysis\": \"A short explanation of the patient's current state.\",\n"
                + "  \"actionRecommended\": \"CONTINUE, BOOK_FOLLOWUP, CONTACT_DOCTOR, or EMERGENCY\"\n"
                + "}";

        String aiResponse = geminiService.generateStructuredJson(
                prompt, schema, "FOLLOWUP_ANALYSIS", plan.getPatientId());

        FollowUpCheckIn checkIn = new FollowUpCheckIn();
        checkIn.setFollowUpPlanId(plan.getId());
        checkIn.setDayNumber(request.getDayNumber());

        try {
            checkIn.setResponses(objectMapper.writeValueAsString(request.getResponses()));
            JsonNode root = objectMapper.readTree(aiResponse);
            checkIn.setAiAnalysis(root.path("aiAnalysis").asText());
            checkIn.setActionRecommended(root.path("actionRecommended").asText());
        } catch (Exception e) {
            throw new RuntimeException("Failed to process check-in: " + e.getMessage(), e);
        }

        checkIn = checkInRepository.save(checkIn);

        // Escalate the plan and alert the doctor if action is needed
        String action = checkIn.getActionRecommended();
        if ("CONTACT_DOCTOR".equals(action) || "EMERGENCY".equals(action)
                || "BOOK_FOLLOWUP".equals(action)) {
            plan.setStatus("ESCALATED");
            planRepository.save(plan);

            eventPublisher.publishEvent(new NotificationEvent(
                    this,
                    plan.getDoctorId(),
                    "Patient Escalation Alert",
                    "Your patient (plan " + plan.getId() + ") requires attention. "
                            + "Recommended action: " + action,
                    NotificationType.FOLLOWUP_ESCALATION,
                    plan.getId().toString()
            ));
        }

        return mapToCheckInResponse(checkIn);
    }

    public List<FollowUpCheckInResponse> getCheckInsForPlan(UUID planId) {
        return checkInRepository.findByFollowUpPlanIdOrderByDayNumberAsc(planId)
                .stream()
                .map(this::mapToCheckInResponse)
                .collect(Collectors.toList());
    }

    /** Compute adherence % and recovery trend from the check-in history. */
    public FollowUpProgressResponse getProgressSummary(UUID planId) {
        FollowUpPlan plan = getPlan(planId);
        List<FollowUpCheckIn> checkIns =
                checkInRepository.findByFollowUpPlanIdOrderByDayNumberAsc(planId);

        FollowUpProgressResponse response = new FollowUpProgressResponse();
        response.setPlanId(planId);

        if (checkIns.isEmpty()) {
            response.setOverallProgressSummary("No check-ins yet.");
            response.setAdherencePercentage(0.0);
            response.setRecoveryTrend("STABLE");
            return response;
        }

        // Adherence = actual check-ins / expected check-ins (capped at 100%)
        long daysPassed = Math.max(1, ChronoUnit.DAYS.between(plan.getStartDate(), LocalDate.now()));
        response.setAdherencePercentage(
                Math.min(100.0, (checkIns.size() / (double) daysPassed) * 100));

        FollowUpCheckIn latest = checkIns.get(checkIns.size() - 1);
        response.setOverallProgressSummary(latest.getAiAnalysis());
        response.setRecoveryTrend("CONTINUE".equals(latest.getActionRecommended())
                ? "IMPROVING" : "WORSENING");

        return response;
    }

    /** Runs at 9 AM daily. Sends a reminder to every patient with an active plan. */
    @Scheduled(cron = "0 0 9 * * *")
    public void sendDailyReminders() {
        List<FollowUpPlan> activePlans = planRepository.findByStatus("ACTIVE");
        for (FollowUpPlan plan : activePlans) {
            if (!LocalDate.now().isAfter(plan.getEndDate())) {
                // Plan is still within its monitoring window — remind the patient
                eventPublisher.publishEvent(new NotificationEvent(
                        this,
                        plan.getPatientId(),
                        "Daily Follow-up Check-in",
                        "It's time for your daily recovery check-in.",
                        NotificationType.FOLLOWUP_REMINDER,
                        plan.getId().toString()
                ));
            } else {
                // Monitoring window expired — mark the plan as complete
                plan.setStatus("COMPLETED");
                planRepository.save(plan);
            }
        }
    }

    private FollowUpCheckInResponse mapToCheckInResponse(FollowUpCheckIn checkIn) {
        FollowUpCheckInResponse response = new FollowUpCheckInResponse();
        response.setId(checkIn.getId());
        response.setFollowUpPlanId(checkIn.getFollowUpPlanId());
        response.setDayNumber(checkIn.getDayNumber());
        response.setResponses(checkIn.getResponses());
        response.setAiAnalysis(checkIn.getAiAnalysis());
        response.setActionRecommended(checkIn.getActionRecommended());
        response.setCreatedAt(checkIn.getCreatedAt());
        return response;
    }
}
