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

        eventPublisher.publishEvent(new NotificationEvent(
            this,
            request.getPatientId(),
            "Follow-up Plan Created",
            "Dr. has created a follow-up plan for your recovery. We will check in with you daily.",
            NotificationType.SYSTEM,
            plan.getId().toString()
        ));

        return plan;
    }

    public FollowUpPlan getPlan(UUID planId) {
        return planRepository.findById(planId).orElseThrow(() -> new RuntimeException("Plan not found"));
    }

    public List<FollowUpPlan> getPlansByPatient(UUID patientId) {
        return planRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    @Transactional
    public FollowUpCheckInResponse processCheckIn(FollowUpCheckInRequest request) {
        FollowUpPlan plan = getPlan(request.getPlanId());
        
        List<FollowUpCheckIn> previousCheckIns = checkInRepository.findByFollowUpPlanIdOrderByDayNumberAsc(plan.getId());
        
        // Prepare context for Gemini
        StringBuilder context = new StringBuilder();
        context.append("Diagnosis: ").append(plan.getDiagnosis()).append("\n");
        context.append("Medicines: ").append(plan.getMedicines()).append("\n");
        context.append("Current Day: ").append(request.getDayNumber()).append(" out of ").append(plan.getFollowUpIntervalDays()).append("\n");
        context.append("Previous check-ins:\n");
        for (FollowUpCheckIn prev : previousCheckIns) {
            context.append("Day ").append(prev.getDayNumber()).append(": ").append(prev.getResponses()).append("\n");
        }
        
        context.append("\nToday's check-in responses:\n");
        request.getResponses().forEach((k, v) -> context.append(k).append(": ").append(v).append("\n"));
        
        String prompt = "You are an AI Follow-up Monitor tracking a patient's recovery.\n" +
                context.toString() + "\n\n" +
                "Evaluate the patient's recovery progress, symptom worsening, and medication adherence.\n";
                
        String schema = "{\n" +
                "  \"aiAnalysis\": \"A short explanation of the patient's current state and progress.\",\n" +
                "  \"actionRecommended\": \"CONTINUE, BOOK_FOLLOWUP, CONTACT_DOCTOR, or EMERGENCY\"\n" +
                "}";

        String aiResponse = geminiService.generateStructuredJson(prompt, schema, "FOLLOWUP_ANALYSIS", plan.getPatientId());

        FollowUpCheckIn checkIn = new FollowUpCheckIn();
        checkIn.setFollowUpPlanId(plan.getId());
        checkIn.setDayNumber(request.getDayNumber());
        
        try {
            checkIn.setResponses(objectMapper.writeValueAsString(request.getResponses()));
            JsonNode rootNode = objectMapper.readTree(aiResponse);
            checkIn.setAiAnalysis(rootNode.path("aiAnalysis").asText());
            checkIn.setActionRecommended(rootNode.path("actionRecommended").asText());
        } catch (Exception e) {
            throw new RuntimeException("Failed to process check-in", e);
        }
        
        checkIn = checkInRepository.save(checkIn);

        // Escalation Logic
        String action = checkIn.getActionRecommended();
        if ("CONTACT_DOCTOR".equals(action) || "EMERGENCY".equals(action) || "BOOK_FOLLOWUP".equals(action)) {
            plan.setStatus("ESCALATED");
            planRepository.save(plan);
            
            eventPublisher.publishEvent(new NotificationEvent(
                this,
                plan.getDoctorId(),
                "Patient Escalation Alert",
                "Your patient for plan " + plan.getId() + " requires attention. Recommended action: " + action,
                NotificationType.FOLLOWUP_ESCALATION,
                plan.getId().toString()
            ));
        }

        return mapToCheckInResponse(checkIn);
    }

    public List<FollowUpCheckInResponse> getCheckInsForPlan(UUID planId) {
        return checkInRepository.findByFollowUpPlanIdOrderByDayNumberAsc(planId).stream()
                .map(this::mapToCheckInResponse)
                .collect(Collectors.toList());
    }

    public FollowUpProgressResponse getProgressSummary(UUID planId) {
        FollowUpPlan plan = getPlan(planId);
        List<FollowUpCheckIn> checkIns = checkInRepository.findByFollowUpPlanIdOrderByDayNumberAsc(planId);
        
        FollowUpProgressResponse response = new FollowUpProgressResponse();
        response.setPlanId(planId);
        
        if (checkIns.isEmpty()) {
            response.setOverallProgressSummary("No check-ins yet.");
            response.setAdherencePercentage(0.0);
            response.setRecoveryTrend("STABLE");
            return response;
        }

        long daysPassed = ChronoUnit.DAYS.between(plan.getStartDate(), LocalDate.now());
        if (daysPassed == 0) daysPassed = 1;
        response.setAdherencePercentage(Math.min(100.0, (checkIns.size() / (double)daysPassed) * 100));

        String latestAnalysis = checkIns.get(checkIns.size() - 1).getAiAnalysis();
        response.setOverallProgressSummary(latestAnalysis);
        
        String latestAction = checkIns.get(checkIns.size() - 1).getActionRecommended();
        if ("CONTINUE".equals(latestAction)) {
            response.setRecoveryTrend("IMPROVING");
        } else {
            response.setRecoveryTrend("WORSENING");
        }

        return response;
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

    @Scheduled(cron = "0 0 9 * * *") // Run at 9 AM every day
    public void sendDailyReminders() {
        List<FollowUpPlan> activePlans = planRepository.findByStatus("ACTIVE");
        for (FollowUpPlan plan : activePlans) {
            if (!LocalDate.now().isAfter(plan.getEndDate())) {
                eventPublisher.publishEvent(new NotificationEvent(
                    this,
                    plan.getPatientId(),
                    "Daily Follow-up Check-in",
                    "It's time for your daily recovery check-in for your recent consultation.",
                    NotificationType.FOLLOWUP_REMINDER,
                    plan.getId().toString()
                ));
            } else {
                plan.setStatus("COMPLETED");
                planRepository.save(plan);
            }
        }
    }
}
