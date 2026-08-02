package com.app.ai.controller;

import com.app.ai.dto.AppointmentRecommendationRequest;
import com.app.ai.dto.AppointmentRecommendationResponse;
import com.app.ai.service.AppointmentRecommendationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai/appointments")
public class AppointmentOptimizerController {

    private final AppointmentRecommendationService recommendationService;

    public AppointmentOptimizerController(AppointmentRecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @PostMapping("/recommend")
    public ResponseEntity<AppointmentRecommendationResponse> recommendDoctors(@RequestBody AppointmentRecommendationRequest request) {
        return ResponseEntity.ok(recommendationService.recommendDoctors(request));
    }

    @GetMapping("/recommendations/{id}")
    public ResponseEntity<AppointmentRecommendationResponse> getRecommendation(@PathVariable UUID id) {
        return ResponseEntity.ok(recommendationService.getRecommendation(id));
    }

    @GetMapping("/recommendations/patient/{patientId}")
    public ResponseEntity<List<AppointmentRecommendationResponse>> getRecommendationsByPatient(@PathVariable UUID patientId) {
        return ResponseEntity.ok(recommendationService.getRecommendationsByPatient(patientId));
    }
}
