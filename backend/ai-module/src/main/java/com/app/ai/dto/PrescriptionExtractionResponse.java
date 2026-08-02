package com.app.ai.dto;

import java.util.List;
import java.util.UUID;

public class PrescriptionExtractionResponse {
    private UUID patientId;
    private String rawAiSummary;
    private List<ExtractedMedicineDTO> medicines;

    public UUID getPatientId() {
        return patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public String getRawAiSummary() {
        return rawAiSummary;
    }

    public void setRawAiSummary(String rawAiSummary) {
        this.rawAiSummary = rawAiSummary;
    }

    public List<ExtractedMedicineDTO> getMedicines() {
        return medicines;
    }

    public void setMedicines(List<ExtractedMedicineDTO> medicines) {
        this.medicines = medicines;
    }
}
