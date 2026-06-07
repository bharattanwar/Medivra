package com.app.record.controller;

import com.app.record.entity.MedicalRecord;
import com.app.record.service.FileStorageService;
import com.app.record.service.MedicalRecordService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/records")
public class RecordController {

    private final MedicalRecordService recordService;
    private final FileStorageService fileStorageService;

    public RecordController(MedicalRecordService recordService, FileStorageService fileStorageService) {
        this.recordService = recordService;
        this.fileStorageService = fileStorageService;
    }

    @PostMapping("/upload")
    public ResponseEntity<MedicalRecord> upload(@RequestParam UUID appointmentId,
                                               @RequestParam UUID doctorId,
                                               @RequestParam UUID patientId,
                                               @RequestParam(required = false) String notes,
                                               @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(recordService.uploadPrescription(appointmentId, doctorId, patientId, notes, file));
    }

    @PostMapping("/digital")
    public ResponseEntity<MedicalRecord> createDigital(@RequestBody com.app.record.dto.DigitalPrescriptionRequest request) {
        return ResponseEntity.ok(recordService.createDigitalPrescription(request));
    }

    @GetMapping("/patient/{id}")
    public ResponseEntity<List<MedicalRecord>> getPatientRecords(@PathVariable UUID id) {
        return ResponseEntity.ok(recordService.getRecordsByPatient(id));
    }

    @GetMapping("/appointment/{id}")
    public ResponseEntity<MedicalRecord> getAppointmentRecord(@PathVariable UUID id) {
        return ResponseEntity.ok(recordService.getRecordByAppointment(id));
    }

    @GetMapping("/download/{filename}")
    public ResponseEntity<Resource> download(@PathVariable String filename) {
        try {
            Path file = fileStorageService.load(filename);
            Resource resource = new UrlResource(file.toUri());

            if (resource.exists() || resource.isReadable()) {
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + resource.getFilename() + "\"")
                        .body(resource);
            } else {
                throw new RuntimeException("Could not read the file!");
            }
        } catch (Exception e) {
            throw new RuntimeException("Error: " + e.getMessage());
        }
    }
    
    @GetMapping("/view/{filename}")
    public ResponseEntity<Resource> view(@PathVariable String filename) {
        try {
            Path file = fileStorageService.load(filename);
            Resource resource = new UrlResource(file.toUri());

            if (resource.exists() || resource.isReadable()) {
                String contentType = "application/octet-stream";
                if (filename.toLowerCase().endsWith(".pdf")) contentType = "application/pdf";
                else if (filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg")) contentType = "image/jpeg";
                else if (filename.toLowerCase().endsWith(".png")) contentType = "image/png";

                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                        .body(resource);
            } else {
                throw new RuntimeException("Could not read the file!");
            }
        } catch (Exception e) {
            throw new RuntimeException("Error: " + e.getMessage());
        }
    }
}
