package com.app.ai.controller;

import com.app.ai.service.AiHealthContextService;
import com.app.record.dto.*;
import com.app.record.entity.CareTask;
import com.app.record.entity.LabReportParameter;
import com.app.record.entity.MedicationDoseLog;
import com.app.record.service.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/journey")
public class HealthJourneyController {

    private final TreatmentPlanService treatmentPlanService;
    private final NextActionService nextActionService;
    private final DeterministicLabService deterministicLabService;
    private final HealthTimelineService healthTimelineService;
    private final DoctorBriefService doctorBriefService;
    private final AiHealthContextService aiHealthContextService;

    public HealthJourneyController(TreatmentPlanService treatmentPlanService,
                                   NextActionService nextActionService,
                                   DeterministicLabService deterministicLabService,
                                   HealthTimelineService healthTimelineService,
                                   DoctorBriefService doctorBriefService,
                                   AiHealthContextService aiHealthContextService) {
        this.treatmentPlanService = treatmentPlanService;
        this.nextActionService = nextActionService;
        this.deterministicLabService = deterministicLabService;
        this.healthTimelineService = healthTimelineService;
        this.doctorBriefService = doctorBriefService;
        this.aiHealthContextService = aiHealthContextService;
    }

    /**
     * Complete Journey Dashboard payload (Next Actions, Active Plan, Progress, Lab Trends, Timeline preview).
     */
    @GetMapping("/patient/{patientId}/dashboard")
    public ResponseEntity<Map<String, Object>> getPatientDashboard(@PathVariable UUID patientId) {
        NextActionResponse nextActions = nextActionService.getNextActionsForPatient(patientId);
        List<LabTrendResponse> labTrends = deterministicLabService.getLabTrendsForPatient(patientId);
        List<HealthTimelineEventDto> timeline = healthTimelineService.getTimelineForPatient(patientId);
        List<TreatmentPlanDto> allPlans = treatmentPlanService.getPlansByPatient(patientId);

        Map<String, Object> response = new HashMap<>();
        response.put("nextActions", nextActions);
        response.put("labTrends", labTrends);
        response.put("recentTimeline", timeline.size() > 5 ? timeline.subList(0, 5) : timeline);
        response.put("treatmentPlans", allPlans);

        return ResponseEntity.ok(response);
    }

    /**
     * Dedicated "What do I need to do next?" Next Action Engine endpoint.
     */
    @GetMapping("/patient/{patientId}/next-actions")
    public ResponseEntity<NextActionResponse> getNextActions(@PathVariable UUID patientId) {
        return ResponseEntity.ok(nextActionService.getNextActionsForPatient(patientId));
    }

    /**
     * Unified Health Timeline (chronological feed of consultations, prescriptions, tasks, lab reports).
     */
    @GetMapping("/patient/{patientId}/timeline")
    public ResponseEntity<List<HealthTimelineEventDto>> getTimeline(@PathVariable UUID patientId) {
        return ResponseEntity.ok(healthTimelineService.getTimelineForPatient(patientId));
    }

    /**
     * List all Treatment Plans for patient.
     */
    @GetMapping("/patient/{patientId}/treatment-plans")
    public ResponseEntity<List<TreatmentPlanDto>> getTreatmentPlans(@PathVariable UUID patientId) {
        return ResponseEntity.ok(treatmentPlanService.getPlansByPatient(patientId));
    }

    /**
     * Get single treatment plan details.
     */
    @GetMapping("/treatment-plan/{planId}")
    public ResponseEntity<TreatmentPlanDto> getTreatmentPlanById(@PathVariable UUID planId) {
        return ResponseEntity.ok(treatmentPlanService.getPlanDtoById(planId));
    }

    /**
     * Confirm explicit dose status (TAKEN or SKIPPED).
     */
    @PostMapping("/dose-log/{doseLogId}/status")
    public ResponseEntity<MedicationDoseLog> confirmDoseStatus(@PathVariable UUID doseLogId,
                                                               @RequestBody DoseConfirmationRequest req) {
        return ResponseEntity.ok(treatmentPlanService.confirmDose(doseLogId, req.getStatus(), req.getPatientNote()));
    }

    /**
     * Mark a care task completed.
     */
    @PostMapping("/task/{taskId}/complete")
    public ResponseEntity<CareTask> completeTask(@PathVariable UUID taskId) {
        return ResponseEntity.ok(treatmentPlanService.completeCareTask(taskId));
    }

    /**
     * Deterministic Lab Parameter Trends with numerical deltas.
     */
    @GetMapping("/patient/{patientId}/lab-trends")
    public ResponseEntity<List<LabTrendResponse>> getLabTrends(@PathVariable UUID patientId) {
        return ResponseEntity.ok(deterministicLabService.getLabTrendsForPatient(patientId));
    }

    /**
     * Ingest structured lab parameters from a report.
     */
    @PostMapping("/lab-parameters")
    public ResponseEntity<List<LabReportParameter>> ingestLabParameters(@RequestBody IngestLabParametersRequest request) {
        return ResponseEntity.ok(deterministicLabService.ingestParameters(request));
    }

    /**
     * Pre-consultation Doctor Brief with objective compliance counts and previous records.
     */
    @GetMapping("/doctor-brief/{patientId}")
    public ResponseEntity<DoctorBriefResponse> getDoctorBrief(@PathVariable UUID patientId) {
        return ResponseEntity.ok(doctorBriefService.generateBrief(patientId));
    }

    /**
     * AI Health Context Layer Q&A (strictly non-diagnostic).
     */
    @PostMapping("/ai-context/ask")
    public ResponseEntity<AiContextResponse> askAiHealthContext(@RequestBody AiContextQuestionRequest request) {
        return ResponseEntity.ok(aiHealthContextService.answerPatientQuestion(request.getPatientId(), request.getQuestion()));
    }
}
