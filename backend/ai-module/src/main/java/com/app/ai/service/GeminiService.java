package com.app.ai.service;

import com.app.ai.entity.AiInteraction;
import com.app.ai.repository.AiInteractionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Low-level client for Google Gemini API.
 *
 * Handles three call patterns:
 *   1. Plain text prompt   → analyzeText()
 *   2. Structured JSON out → generateStructuredJson()
 *   3. Image (base-64)    → analyzeImage()
 *
 * Every call is logged to the AiInteraction table so we can
 * track latency, model version, and usage over time.
 */
@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);
    private static final String GEMINI_BASE_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/";

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

    /** Send a plain-text prompt and get a text response. */
    public String analyzeText(String prompt, String interactionType, UUID userId) {
        return callGeminiApi(modelText, prompt, null, null, interactionType, userId);
    }

    /**
     * Send a prompt and ask Gemini to respond in JSON matching the given schema.
     * The schema is appended to the prompt so the model knows what shape to return.
     */
    public String generateStructuredJson(String prompt, String schema,
                                         String interactionType, UUID userId) {
        String fullPrompt = prompt
                + "\n\nProvide the output in JSON format exactly matching this schema:\n"
                + schema;
        return callGeminiApi(modelText, fullPrompt, null, null, interactionType, userId);
    }

    /**
     * Send an image alongside a text prompt (e.g., for report or prescription analysis).
     * The image is base-64 encoded and sent inline.
     */
    public String analyzeImage(String prompt, byte[] imageBytes, String mimeType,
                                String interactionType, UUID userId) {
        String base64Image = Base64.getEncoder().encodeToString(imageBytes);
        return callGeminiApi(modelVision, prompt, base64Image, mimeType, interactionType, userId);
    }

    // ── Core API caller ──────────────────────────────────────────────────────

    private String callGeminiApi(String model, String prompt, String base64Image,
                                  String mimeType, String interactionType, UUID userId) {
        long startTime = System.currentTimeMillis();

        String url = GEMINI_BASE_URL + model + ":generateContent?key=" + apiKey;
        log.debug("Calling Gemini model={} interactionType={}", model, interactionType);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Build the request body: { contents: [{ parts: [textPart, ?imagePart] }] }
            List<Map<String, Object>> parts = new ArrayList<>();

            Map<String, Object> textPart = new HashMap<>();
            textPart.put("text", prompt);
            parts.add(textPart);

            // Attach image if provided (vision requests only)
            if (base64Image != null && mimeType != null) {
                Map<String, Object> inlineData = new HashMap<>();
                inlineData.put("mimeType", mimeType);
                inlineData.put("data", base64Image);

                Map<String, Object> imagePart = new HashMap<>();
                imagePart.put("inlineData", inlineData);
                parts.add(imagePart);
            }

            Map<String, Object> content = new HashMap<>();
            content.put("parts", parts);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("contents", List.of(content));

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

            long latencyMs = System.currentTimeMillis() - startTime;
            String responseText = extractTextFromResponse(response.getBody());

            logInteraction(userId, interactionType, prompt, responseText, model, latencyMs);

            // Strip markdown code fences that Gemini sometimes wraps JSON in
            responseText = stripMarkdownFences(responseText);

            log.debug("Gemini call complete latency={}ms interactionType={}", latencyMs, interactionType);
            return responseText;

        } catch (Exception e) {
            long latencyMs = System.currentTimeMillis() - startTime;
            logInteraction(userId, interactionType, prompt, "ERROR: " + e.getMessage(), model, latencyMs);
            throw new RuntimeException("Failed to call Gemini API: " + e.getMessage(), e);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Pull the text out of the Gemini candidates[0].content.parts[0].text path. */
    private String extractTextFromResponse(String responseBody) throws Exception {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode candidates = root.path("candidates");
        if (candidates.isArray() && !candidates.isEmpty()) {
            JsonNode parts = candidates.get(0).path("content").path("parts");
            if (parts.isArray() && !parts.isEmpty()) {
                return parts.get(0).path("text").asText();
            }
        }
        return "";
    }

    /**
     * Gemini occasionally wraps JSON responses in ```json ... ``` fences.
     * Strip them so callers always get clean JSON.
     */
    private String stripMarkdownFences(String text) {
        String trimmed = text.trim();
        if (trimmed.startsWith("```json")) {
            trimmed = trimmed.substring(7);
            if (trimmed.endsWith("```")) {
                trimmed = trimmed.substring(0, trimmed.length() - 3);
            }
        } else if (trimmed.startsWith("```")) {
            trimmed = trimmed.substring(3);
            if (trimmed.endsWith("```")) {
                trimmed = trimmed.substring(0, trimmed.length() - 3);
            }
        }
        return trimmed.trim();
    }

    /** Persist an interaction record for auditing and latency tracking. */
    private void logInteraction(UUID userId, String type, String prompt,
                                 String response, String model, long latencyMs) {
        try {
            AiInteraction interaction = new AiInteraction();
            interaction.setUserId(userId);
            interaction.setInteractionType(type);
            // Truncate long prompts so we don't bloat the DB
            interaction.setRequestSummary(
                    prompt.length() > 500 ? prompt.substring(0, 500) + "..." : prompt);
            interaction.setResponseText(response);
            interaction.setModelUsed(model);
            interaction.setLatencyMs(latencyMs);
            interactionRepository.save(interaction);
        } catch (Exception e) {
            // Never let logging failures break the actual AI response
            log.warn("Failed to persist AI interaction log: {}", e.getMessage());
        }
    }
}
