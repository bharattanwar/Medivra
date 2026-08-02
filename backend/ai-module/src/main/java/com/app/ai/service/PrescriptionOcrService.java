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
            // 1. Call Gemini for extraction
            String prompt = "You are an AI Prescription Extraction system. Read the attached handwritten prescription image and extract the list of prescribed medicines.\n" +
                    "Return the output in JSON format exactly matching this schema:\n" + getAiSchema();
            
            String aiResponse = geminiService.analyzeImage(prompt, file.getBytes(), file.getContentType(), "PRESCRIPTION_OCR", request.getPatientId());
            
            // Clean markdown blocks
            if (aiResponse.startsWith("```json")) {
                aiResponse = aiResponse.substring(7);
                if (aiResponse.endsWith("```")) {
                    aiResponse = aiResponse.substring(0, aiResponse.length() - 3);
                }
            }
            aiResponse = aiResponse.trim();
            
            // 2. Parse JSON
            JsonNode rootNode = objectMapper.readTree(aiResponse);
            String rawSummary = rootNode.path("summary").asText("");
            JsonNode medicinesNode = rootNode.path("medicines");
            
            List<ExtractedMedicineDTO> extractedMedicines = new ArrayList<>();
            
            // Fetch all medicines once for fuzzy matching
            List<Medicine> allMedicines = medicineRepository.findAll();
            
            if (medicinesNode.isArray()) {
                for (JsonNode medNode : medicinesNode) {
                    ExtractedMedicineDTO dto = new ExtractedMedicineDTO();
                    String extractedName = medNode.path("name").asText("");
                    dto.setExtractedName(extractedName);
                    dto.setDosage(medNode.path("dosage").asText(""));
                    dto.setFrequency(medNode.path("frequency").asText(""));
                    dto.setDuration(medNode.path("duration").asText(""));
                    dto.setQuantity(medNode.path("quantity").asInt(1));
                    
                    // 3. Fuzzy Matching
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
    
    private void matchMedicine(ExtractedMedicineDTO dto, String extractedName, List<Medicine> allMedicines) {
        if (extractedName == null || extractedName.isEmpty()) {
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
            
            int score = 0;
            if (maxLength > 0) {
                score = (int) Math.round((1.0 - ((double) distance / maxLength)) * 100);
            }
            
            if (score > highestScore) {
                highestScore = score;
                bestMatch = dbMed;
            }
        }
        
        dto.setConfidenceScore(highestScore);
        
        // Threshold for a "good" match (e.g., > 60%)
        if (bestMatch != null && highestScore >= 60) {
            dto.setMatchedMedicineId(bestMatch.getId());
            dto.setMatchedMedicineName(bestMatch.getName());
        }
    }
    
    private String getAiSchema() {
        return "{\n" +
               "  \"summary\": \"Brief summary of the prescription (e.g., patient name, date, doctor notes if any)\",\n" +
               "  \"medicines\": [\n" +
               "    {\n" +
               "      \"name\": \"Name of the medicine\",\n" +
               "      \"dosage\": \"E.g., 500mg\",\n" +
               "      \"frequency\": \"E.g., 1-0-1 (twice a day)\",\n" +
               "      \"duration\": \"E.g., 5 days\",\n" +
               "      \"quantity\": integer (calculated based on frequency and duration, e.g., twice a day for 5 days = 10)\n" +
               "    }\n" +
               "  ]\n" +
               "}";
    }
}
