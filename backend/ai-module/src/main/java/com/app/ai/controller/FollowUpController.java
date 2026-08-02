package com.app.ai.controller;

import com.app.ai.dto.FollowUpCheckInRequest;
import com.app.ai.dto.FollowUpCheckInResponse;
import com.app.ai.dto.FollowUpPlanRequest;
import com.app.ai.dto.FollowUpProgressResponse;
import com.app.ai.entity.FollowUpPlan;
import com.app.ai.service.FollowUpAssistantService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai/followup")
public class FollowUpController {

    private final FollowUpAssistantService followUpService;

    public FollowUpController(FollowUpAssistantService followUpService) {
        this.followUpService = followUpService;
    }

    @PostMapping("/plans")
    public ResponseEntity<FollowUpPlan> createPlan(@RequestBody FollowUpPlanRequest request) {
        return ResponseEntity.ok(followUpService.createPlan(request));
    }

    @GetMapping("/plans/{planId}")
    public ResponseEntity<FollowUpPlan> getPlan(@PathVariable UUID planId) {
        return ResponseEntity.ok(followUpService.getPlan(planId));
    }

    @GetMapping("/plans/patient/{patientId}")
    public ResponseEntity<List<FollowUpPlan>> getPlansByPatient(@PathVariable UUID patientId) {
        return ResponseEntity.ok(followUpService.getPlansByPatient(patientId));
    }

    @PostMapping("/checkin")
    public ResponseEntity<FollowUpCheckInResponse> processCheckIn(@RequestBody FollowUpCheckInRequest request) {
        return ResponseEntity.ok(followUpService.processCheckIn(request));
    }

    @GetMapping("/plans/{planId}/checkins")
    public ResponseEntity<List<FollowUpCheckInResponse>> getCheckInsForPlan(@PathVariable UUID planId) {
        return ResponseEntity.ok(followUpService.getCheckInsForPlan(planId));
    }

    @GetMapping("/plans/{planId}/progress")
    public ResponseEntity<FollowUpProgressResponse> getProgressSummary(@PathVariable UUID planId) {
        return ResponseEntity.ok(followUpService.getProgressSummary(planId));
    }
}
