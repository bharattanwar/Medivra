package com.app.ai.controller;

import com.app.ai.dto.ReportAnalysisRequest;
import com.app.ai.dto.ReportAnalysisResponse;
import com.app.ai.service.ReportAnalysisService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai/reports")
public class ReportAnalysisController {

    private final ReportAnalysisService reportAnalysisService;

    public ReportAnalysisController(ReportAnalysisService reportAnalysisService) {
        this.reportAnalysisService = reportAnalysisService;
    }

    @PostMapping("/analyze")
    public ResponseEntity<ReportAnalysisResponse> analyzeReport(
            @RequestParam("patientId") UUID patientId,
            @RequestParam("reportType") String reportType,
            @RequestParam("file") MultipartFile file) {
        
        ReportAnalysisRequest request = new ReportAnalysisRequest();
        request.setPatientId(patientId);
        request.setReportType(reportType);
        request.setFile(file);
        
        return ResponseEntity.ok(reportAnalysisService.analyzeReport(request));
    }

    @GetMapping("/{id}/summary")
    public ResponseEntity<ReportAnalysisResponse> getReportSummary(@PathVariable UUID id) {
        return ResponseEntity.ok(reportAnalysisService.getReportSummary(id));
    }

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<ReportAnalysisResponse>> getReportsByPatient(@PathVariable UUID patientId) {
        return ResponseEntity.ok(reportAnalysisService.getReportsByPatient(patientId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReport(@PathVariable UUID id) {
        reportAnalysisService.deleteReport(id);
        return ResponseEntity.ok().build();
    }
}
