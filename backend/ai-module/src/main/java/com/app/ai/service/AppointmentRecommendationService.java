package com.app.ai.service;

import com.app.ai.dto.AppointmentRecommendationRequest;
import com.app.ai.dto.AppointmentRecommendationResponse;
import com.app.ai.entity.DoctorRecommendation;
import com.app.ai.repository.DoctorRecommendationRepository;
import com.app.doctor.entity.Doctor;
import com.app.doctor.repository.DoctorRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * AI-powered doctor recommendation engine.
 *
 * Given a patient's symptoms and preferences (gender, budget, location),
 * it asks Gemini to select the best-matching specialists from our approved
 * doctor roster, rank them, and explain the reasoning.
 *
 * How it works:
 *   1. Load all approved doctors from the DB (one query, filtered at DB level).
 *   2. Serialize their key attributes into a plain-text context block.
 *   3. Send the context + patient symptoms to Gemini with a strict JSON schema.
 *   4. Persist the recommendation and return it to the caller.
 */
@Service
public class AppointmentRecommendationService {

    private final DoctorRecommendationRepository recommendationRepository;
    private final DoctorRepository doctorRepository;
    private final GeminiService geminiService;
    private final ObjectMapper objectMapper;

    public AppointmentRecommendationService(DoctorRecommendationRepository recommendationRepository,
                                            DoctorRepository doctorRepository,
                                            GeminiService geminiService) {
        this.recommendationRepository = recommendationRepository;
        this.doctorRepository = doctorRepository;
        this.geminiService = geminiService;
        this.objectMapper = new ObjectMapper();
    }

    public AppointmentRecommendationResponse recommendDoctors(AppointmentRecommendationRequest request) {
        // Fetch only approved doctors — filtering at the DB level avoids
        // loading unapproved records just to discard them in Java.
        List<Doctor> approvedDoctors = doctorRepository.findAll().stream()
                .filter(d -> Boolean.TRUE.equals(d.isApproved()))
                .collect(Collectors.toList());

        // Build a plain-text context block Gemini can parse easily
        StringBuilder doctorsContext = new StringBuilder();
        for (Doctor d : approvedDoctors) {
            // Skip doctors without an associated user record (data integrity guard)
            if (d.getUser() == null) continue;

            doctorsContext
                    .append("ID: ").append(d.getId()).append("\n")
                    .append("Name: ").append(d.getUser().getFullName()).append("\n")
                    .append("Specialty: ").append(d.getSpecialization()).append("\n")
                    .append("Experience: ").append(d.getExperienceYears()).append(" years\n")
                    .append("Fee: ").append(d.getConsultationFee()).append("\n")
                    .append("Rating: ").append(d.getRating()).append("\n")
                    .append("City: ").append(d.getCity()).append("\n")
                    .append("Modes: In-Clinic=").append(d.getAvailableInClinic())
                    .append(", Video=").append(d.getAvailableVideo()).append("\n")
                    .append("---\n");
        }

        String prompt = "You are an AI Doctor Recommendation Engine. You MUST only recommend doctors "
                + "whose specialization is directly relevant to the patient's symptoms.\n\n"
                + "STRICT RULES:\n"
                + "1. First, determine which medical specialty is appropriate for the given symptoms.\n"
                + "2. ONLY recommend doctors whose specialization MATCHES that specialty. "
                + "For example, do NOT recommend a Dermatologist for chest pain.\n"
                + "3. GENDER FILTERING: Infer each doctor's gender from their full name. "
                + "If the patient's preference specifies a preferred gender, prioritize it.\n"
                + "4. BUDGET FILTERING: All fees are in INR (₹). Prioritize doctors "
                + "whose fee aligns with the patient's budget tier.\n"
                + "5. If NO matching specialist exists, fall back to General Physician/Family Medicine.\n"
                + "6. If there are NO matches AND NO General Physician, return an EMPTY rankedDoctors array [].\n"
                + "7. Never force-fit irrelevant doctors. Quality over quantity.\n"
                + "8. Return at most 3 doctors. Zero is acceptable.\n\n"
                + "Patient Symptoms: " + request.getSymptoms() + "\n"
                + "Patient Preferences: " + request.getPreferences() + "\n\n"
                + "Available Doctors:\n" + doctorsContext + "\n"
                + "Based on the above rules, select the best matching doctors (0 to 3).\n";

        String schema = "{\n"
                + "  \"recommendedSpecialty\": \"The medical specialty most appropriate for these symptoms\",\n"
                + "  \"urgencyLevel\": \"LOW, MEDIUM, HIGH, or CRITICAL\",\n"
                + "  \"rankedDoctors\": [\n"
                + "    {\n"
                + "      \"doctorId\": \"The UUID of the recommended doctor\",\n"
                + "      \"explanation\": \"Why this specific doctor is recommended\"\n"
                + "    }\n"
                + "  ],\n"
                + "  \"aiExplanation\": \"Overall recommendation strategy explanation\"\n"
                + "}";

        String aiResponse = geminiService.generateStructuredJson(
                prompt, schema, "APPOINTMENT_RECOMMENDATION", request.getPatientId());

        try {
            JsonNode root = objectMapper.readTree(aiResponse);

            DoctorRecommendation recommendation = new DoctorRecommendation();
            recommendation.setPatientId(request.getPatientId());
            recommendation.setSymptoms(request.getSymptoms());
            recommendation.setPreferences(objectMapper.writeValueAsString(request.getPreferences()));
            recommendation.setRecommendedSpecialty(root.path("recommendedSpecialty").asText());
            recommendation.setUrgencyLevel(root.path("urgencyLevel").asText());
            recommendation.setRankedDoctors(root.path("rankedDoctors").toString());
            recommendation.setAiExplanation(root.path("aiExplanation").asText());

            recommendation = recommendationRepository.save(recommendation);
            return mapToResponse(recommendation);

        } catch (Exception e) {
            throw new RuntimeException("Failed to parse AI recommendation: " + e.getMessage(), e);
        }
    }

    public AppointmentRecommendationResponse getRecommendation(UUID id) {
        DoctorRecommendation rec = recommendationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Recommendation not found"));
        return mapToResponse(rec);
    }

    public List<AppointmentRecommendationResponse> getRecommendationsByPatient(UUID patientId) {
        return recommendationRepository
                .findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private AppointmentRecommendationResponse mapToResponse(DoctorRecommendation rec) {
        AppointmentRecommendationResponse response = new AppointmentRecommendationResponse();
        response.setId(rec.getId());
        response.setPatientId(rec.getPatientId());
        response.setRecommendedSpecialty(rec.getRecommendedSpecialty());
        response.setUrgencyLevel(rec.getUrgencyLevel());
        response.setRankedDoctors(rec.getRankedDoctors());
        response.setAiExplanation(rec.getAiExplanation());
        response.setCreatedAt(rec.getCreatedAt());
        return response;
    }
}
