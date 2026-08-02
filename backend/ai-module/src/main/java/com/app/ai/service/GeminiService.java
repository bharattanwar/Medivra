package com.app.ai.service;

import com.app.ai.entity.AiInteraction;
import com.app.ai.repository.AiInteractionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class GeminiService {

    private final RestTemplate restTemplate;
    private final AiInteractionRepository interactionRepository;
    private final ObjectMapper objectMapper;

    @Value("${ai.gemini.api-key}")
    private String apiKey;

    @Value("${ai.gemini.model-text:gemini-flash-latest}")
    private String modelText;

    @Value("${ai.gemini.model-vision:gemini-flash-latest}")
    private String modelVision;

    public GeminiService(AiInteractionRepository interactionRepository) {
        this.restTemplate = new RestTemplate();
        this.interactionRepository = interactionRepository;
        this.objectMapper = new ObjectMapper();
    }

    public String analyzeText(String prompt, String interactionType, UUID userId) {
        return callGeminiApi(modelText, prompt, null, null, interactionType, userId);
    }

    public String generateStructuredJson(String prompt, String schema, String interactionType, UUID userId) {
        String fullPrompt = prompt + "\n\nProvide the output in JSON format exactly matching this schema:\n" + schema;
        return callGeminiApi(modelText, fullPrompt, null, null, interactionType, userId);
    }

    public String analyzeImage(String prompt, byte[] imageBytes, String mimeType, String interactionType, UUID userId) {
        String base64Image = java.util.Base64.getEncoder().encodeToString(imageBytes);
        return callGeminiApi(modelVision, prompt, base64Image, mimeType, interactionType, userId);
    }

    private String callGeminiApi(String model, String prompt, String base64Image, String mimeType,
            String interactionType, UUID userId) {
        long startTime = System.currentTimeMillis();
        System.out.println("TEXT MODEL = " + modelText);
        System.out.println("VISION MODEL = " + modelVision);
        System.out.println("MODEL PASSED = " + model);

        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key="
                + apiKey;
        System.out.println("========== GEMINI DEBUG ==========");
        System.out.println("API KEY = [" + apiKey + "]");
        System.out.println("MODEL = " + model);
        System.out.println("URL = " + url);
        System.out.println("==================================");

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> requestBody = new HashMap<>();
            List<Map<String, Object>> contents = new ArrayList<>();
            Map<String, Object> content = new HashMap<>();
            List<Map<String, Object>> parts = new ArrayList<>();

            Map<String, Object> textPart = new HashMap<>();
            textPart.put("text", prompt);
            parts.add(textPart);

            if (base64Image != null && mimeType != null) {
                Map<String, Object> inlineData = new HashMap<>();
                inlineData.put("mimeType", mimeType);
                inlineData.put("data", base64Image);
                Map<String, Object> imagePart = new HashMap<>();
                imagePart.put("inlineData", inlineData);
                parts.add(imagePart);
            }

            content.put("parts", parts);
            contents.add(content);
            requestBody.put("contents", contents);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

            long latencyMs = System.currentTimeMillis() - startTime;

            String responseText = extractTextFromResponse(response.getBody());

            logInteraction(userId, interactionType, prompt, responseText, model, latencyMs);

            // Clean up markdown json block if it exists
            if (responseText.startsWith("```json")) {
                responseText = responseText.substring(7);
                if (responseText.endsWith("```")) {
                    responseText = responseText.substring(0, responseText.length() - 3);
                }
            }

            return responseText.trim();
        } catch (Exception e) {
            long latencyMs = System.currentTimeMillis() - startTime;
            logInteraction(userId, interactionType, prompt, "ERROR: " + e.getMessage(), model, latencyMs);
            throw new RuntimeException("Failed to call Gemini API: " + e.getMessage());
        }
    }

    private String extractTextFromResponse(String responseBody) throws Exception {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode candidates = root.path("candidates");
        if (candidates.isArray() && candidates.size() > 0) {
            JsonNode parts = candidates.get(0).path("content").path("parts");
            if (parts.isArray() && parts.size() > 0) {
                return parts.get(0).path("text").asText();
            }
        }
        return "";
    }

    private void logInteraction(UUID userId, String type, String prompt, String response, String model,
            long latencyMs) {
        AiInteraction interaction = new AiInteraction();
        interaction.setUserId(userId);
        interaction.setInteractionType(type);
        interaction.setRequestSummary(prompt.length() > 500 ? prompt.substring(0, 500) + "..." : prompt);
        interaction.setResponseText(response);
        interaction.setModelUsed(model);
        interaction.setLatencyMs(latencyMs);
        interactionRepository.save(interaction);
    }
}
