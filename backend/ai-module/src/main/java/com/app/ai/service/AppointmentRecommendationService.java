package com.app.ai.service;

import com.app.ai.dto.AppointmentRecommendationRequest;
import com.app.ai.dto.AppointmentRecommendationResponse;
import com.app.ai.entity.DoctorRecommendation;
import com.app.ai.repository.DoctorRecommendationRepository;
import com.app.doctor.entity.Doctor;
import com.app.doctor.repository.DoctorRepository;
import com.app.user.entity.User;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

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
        // 1. Get all approved doctors
        List<Doctor> allDoctors = doctorRepository.findAll().stream()
                .filter(d -> Boolean.TRUE.equals(d.isApproved()))
                .collect(Collectors.toList());

        // We convert doctors to a simplified JSON string to pass to LLM
        StringBuilder doctorsContext = new StringBuilder();
        for (Doctor d : allDoctors) {
            User user = d.getUser();
            if (user == null) continue; // Safety check
            doctorsContext.append("ID: ").append(d.getId()).append("\n");
            doctorsContext.append("Name: ").append(user.getFullName()).append("\n");
            doctorsContext.append("Specialty: ").append(d.getSpecialization()).append("\n");
            doctorsContext.append("Experience: ").append(d.getExperienceYears()).append(" years\n");
            doctorsContext.append("Fee: ").append(d.getConsultationFee()).append("\n");
            doctorsContext.append("Rating: ").append(d.getRating()).append("\n");
            doctorsContext.append("City: ").append(d.getCity()).append("\n");
            doctorsContext.append("Modes: In-Clinic=").append(d.getAvailableInClinic()).append(", Video=").append(d.getAvailableVideo()).append("\n");
            doctorsContext.append("---\n");
        }

        // 2. Call Gemini
        String prompt = "You are an AI Doctor Recommendation Engine. You MUST only recommend doctors whose specialization is directly relevant to the patient's symptoms.\n\n" +
                "STRICT RULES:\n" +
                "1. First, determine which medical specialty is appropriate for the given symptoms.\n" +
                "2. ONLY recommend doctors whose specialization MATCHES that specialty. For example, do NOT recommend a Dermatologist for chest pain or a Cardiologist for skin issues.\n" +
                "3. GENDER FILTERING: Infer each doctor's gender from their full name (e.g., female names like Ananya, Priya, Sunita, Kavita -> Female; male names like Rajesh, Vikram, Suresh, Amit -> Male). If the patient's preference specifies a preferred gender ('Male' or 'Female'), strongly prioritize doctors of that gender among qualified specialists.\n" +
                "4. BUDGET FILTERING: All fees are in INR (₹). If patient preferences specify a budget (e.g., 'Budget (< ₹500)', 'Moderate (₹500 - ₹1,000)', 'Premium (> ₹1,000)'), prioritize doctors whose consultation fee aligns with that budget tier.\n" +
                "5. If NO doctor in the list has a matching specialization, check if there is a General Physician / General Medicine / Family Medicine doctor available. If yes, recommend them as a fallback.\n" +
                "6. If there are NO matching specialists AND NO General Physician available, return an EMPTY rankedDoctors array [].\n" +
                "7. Never force-fit irrelevant doctors just to fill the list. Quality over quantity.\n" +
                "8. Return at most 3 doctors, but fewer if fewer are relevant. Zero is acceptable.\n\n" +
                "Patient Symptoms: " + request.getSymptoms() + "\n" +
                "Patient Preferences: " + request.getPreferences() + "\n\n" +
                "Available Doctors:\n" + doctorsContext.toString() + "\n\n" +
                "Based on the above rules, select the best matching doctors (0 to 3).\n";
        
        String schema = "{\n" +
                "  \"recommendedSpecialty\": \"The medical specialty most appropriate for these symptoms\",\n" +
                "  \"urgencyLevel\": \"LOW, MEDIUM, HIGH, or CRITICAL\",\n" +
                "  \"rankedDoctors\": [\n" +
                "    {\n" +
                "      \"doctorId\": \"The UUID of the recommended doctor\",\n" +
                "      \"explanation\": \"Why this specific doctor is recommended based on their specialty match and the patient's symptoms/preferences\"\n" +
                "    }\n" +
                "  ],\n" +
                "  \"aiExplanation\": \"Overall explanation of the recommendation strategy. If no doctors matched, explain why and suggest what specialty the patient should look for.\"\n" +
                "}";

        String aiResponse = geminiService.generateStructuredJson(prompt, schema, "APPOINTMENT_RECOMMENDATION", request.getPatientId());

        try {
            JsonNode rootNode = objectMapper.readTree(aiResponse);
            
            DoctorRecommendation recommendation = new DoctorRecommendation();
            recommendation.setPatientId(request.getPatientId());
            recommendation.setSymptoms(request.getSymptoms());
            recommendation.setPreferences(objectMapper.writeValueAsString(request.getPreferences()));
            recommendation.setRecommendedSpecialty(rootNode.path("recommendedSpecialty").asText());
            recommendation.setUrgencyLevel(rootNode.path("urgencyLevel").asText());
            recommendation.setRankedDoctors(rootNode.path("rankedDoctors").toString());
            recommendation.setAiExplanation(rootNode.path("aiExplanation").asText());
            
            recommendation = recommendationRepository.save(recommendation);

            return mapToResponse(recommendation);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse AI recommendation: " + e.getMessage(), e);
        }
    }

    public AppointmentRecommendationResponse getRecommendation(UUID id) {
        DoctorRecommendation recommendation = recommendationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Recommendation not found"));
        return mapToResponse(recommendation);
    }

    public List<AppointmentRecommendationResponse> getRecommendationsByPatient(UUID patientId) {
        return recommendationRepository.findByPatientIdOrderByCreatedAtDesc(patientId).stream()
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
