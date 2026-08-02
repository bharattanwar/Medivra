package com.app.ai.dto;

import org.springframework.web.multipart.MultipartFile;
import java.util.UUID;

public class PrescriptionExtractionRequest {
    private UUID patientId;
    private MultipartFile file;

    public UUID getPatientId() {
        return patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public MultipartFile getFile() {
        return file;
    }

    public void setFile(MultipartFile file) {
        this.file = file;
    }
}
