package com.app.ai.service;

import com.app.ai.dto.ExtractedMedicineDTO;
import com.app.ai.dto.PrescriptionExtractionRequest;
import com.app.ai.dto.PrescriptionExtractionResponse;
import com.app.pharmacy.entity.Medicine;
import com.app.pharmacy.repository.MedicineRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.text.similarity.LevenshteinDistance;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Reads a handwritten or printed prescription image and extracts medicines using Gemini vision.
 *
 * Flow:
 *   1. Send the image bytes to Gemini and ask for structured JSON (name, dosage, frequency, duration).
 *   2. For each extracted medicine name, fuzzy-match it against our medicine catalog
 *      using Levenshtein edit distance (≥ 60% similarity = match).
 *   3. Return the list with matched medicine IDs so the pharmacy finder can resolve real stock.
 *
 * NOTE: `medicineRepository.findAll()` loads the full catalog on each call. If the catalog
 * grows very large (10,000+ entries), add @Cacheable("medicines") to the repository method.
 */
@Service
public class PrescriptionOcrService {

    private final GeminiService geminiService;
    private final MedicineRepository medicineRepository;
    private final ObjectMapper objectMapper;
    private final LevenshteinDistance levenshteinDistance;

    public PrescriptionOcrService(GeminiService geminiService, MedicineRepository medicineRepository) {
        this.geminiService = geminiService;
        this.medicineRepository = medicineRepository;
        this.objectMapper = new ObjectMapper();
        this.levenshteinDistance = LevenshteinDistance.getDefaultInstance();
    }

    public PrescriptionExtractionResponse extractPrescription(PrescriptionExtractionRequest request) {
        MultipartFile file = request.getFile();

        try {
            // 1. Ask Gemini to read the prescription image
            String prompt = "You are an AI Prescription Extraction system. Read the attached "
                    + "handwritten prescription image and extract the list of prescribed medicines.\n"
                    + "Return the output in JSON format exactly matching this schema:\n"
                    + getAiSchema();

            String aiResponse = geminiService.analyzeImage(
                    prompt, file.getBytes(), file.getContentType(),
                    "PRESCRIPTION_OCR", request.getPatientId());

            // 2. Parse the AI JSON response
            JsonNode root = objectMapper.readTree(aiResponse);
            String rawSummary = root.path("summary").asText("");
            JsonNode medicinesNode = root.path("medicines");

            // Load the full medicine catalog once for fuzzy matching
            List<Medicine> allMedicines = medicineRepository.findAll();
            List<ExtractedMedicineDTO> extractedMedicines = new ArrayList<>();

            if (medicinesNode.isArray()) {
                for (JsonNode medNode : medicinesNode) {
                    ExtractedMedicineDTO dto = new ExtractedMedicineDTO();
                    String extractedName = medNode.path("name").asText("");
                    dto.setExtractedName(extractedName);
                    dto.setDosage(medNode.path("dosage").asText(""));
                    dto.setFrequency(medNode.path("frequency").asText(""));
                    dto.setDuration(medNode.path("duration").asText(""));
                    dto.setQuantity(medNode.path("quantity").asInt(1));

                    // 3. Fuzzy-match name against catalog — sets matchedMedicineId if confidence ≥ 60%
                    matchMedicine(dto, extractedName, allMedicines);
                    extractedMedicines.add(dto);
                }
            }

            PrescriptionExtractionResponse response = new PrescriptionExtractionResponse();
            response.setPatientId(request.getPatientId());
            response.setRawAiSummary(rawSummary);
            response.setMedicines(extractedMedicines);
            return response;

        } catch (Exception e) {
            throw new RuntimeException("Failed to extract prescription: " + e.getMessage(), e);
        }
    }

    /**
     * Scores each catalog medicine against the extracted name using Levenshtein distance.
     * A score of ≥ 60 out of 100 is considered a reliable match.
     */
    private void matchMedicine(ExtractedMedicineDTO dto, String extractedName,
                                List<Medicine> allMedicines) {
        if (extractedName == null || extractedName.isBlank()) {
            dto.setConfidenceScore(0);
            return;
        }

        String query = extractedName.toLowerCase().trim();
        Medicine bestMatch = null;
        int highestScore = 0;

        for (Medicine dbMed : allMedicines) {
            String dbName = dbMed.getName().toLowerCase().trim();
            int distance = levenshteinDistance.apply(query, dbName);
            int maxLength = Math.max(query.length(), dbName.length());

            int score = maxLength > 0
                    ? (int) Math.round((1.0 - ((double) distance / maxLength)) * 100)
                    : 0;

            if (score > highestScore) {
                highestScore = score;
                bestMatch = dbMed;
            }
        }

        dto.setConfidenceScore(highestScore);

        // Only accept matches with ≥ 60% similarity to avoid false positives
        if (bestMatch != null && highestScore >= 60) {
            dto.setMatchedMedicineId(bestMatch.getId());
            dto.setMatchedMedicineName(bestMatch.getName());
        }
    }

    /** JSON schema sent to Gemini to control the shape of its response. */
    private String getAiSchema() {
        return "{\n"
                + "  \"summary\": \"Brief summary of the prescription (patient name, date, doctor notes if any)\",\n"
                + "  \"medicines\": [\n"
                + "    {\n"
                + "      \"name\": \"Name of the medicine\",\n"
                + "      \"dosage\": \"E.g., 500mg\",\n"
                + "      \"frequency\": \"E.g., 1-0-1 (twice a day)\",\n"
                + "      \"duration\": \"E.g., 5 days\",\n"
                + "      \"quantity\": \"integer (e.g., twice a day for 5 days = 10)\"\n"
                + "    }\n"
                + "  ]\n"
                + "}";
    }
}
