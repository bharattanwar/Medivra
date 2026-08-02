package com.app.ai.controller;

import com.app.ai.dto.PrescriptionExtractionRequest;
import com.app.ai.dto.PrescriptionExtractionResponse;
import com.app.ai.service.PrescriptionOcrService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/ai/prescriptions")
public class PrescriptionOcrController {

    private final PrescriptionOcrService ocrService;

    public PrescriptionOcrController(PrescriptionOcrService ocrService) {
        this.ocrService = ocrService;
    }

    @PostMapping("/extract")
    public ResponseEntity<PrescriptionExtractionResponse> extractPrescription(
            @RequestParam("patientId") UUID patientId,
            @RequestParam("file") MultipartFile file) {
        
        PrescriptionExtractionRequest request = new PrescriptionExtractionRequest();
        request.setPatientId(patientId);
        request.setFile(file);
        
        return ResponseEntity.ok(ocrService.extractPrescription(request));
    }
}
