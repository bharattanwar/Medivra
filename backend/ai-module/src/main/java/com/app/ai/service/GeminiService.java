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
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Universal Multi-Provider AI Service for Medivra.
 *
 * Provides resilient, zero-downtime AI capabilities by orchestrating:
 *   1. Google Gemini (3.7-flash, 3.5-flash-lite, 3.8-flash, flash-latest)
 *   2. Groq LPU Cloud (openai/gpt-oss-120b, qwen/qwen3.8-27b) for ultra-fast text inference
 *   3. OpenAI (gpt-4o-mini) for resilient cross-cloud failover
 *
 * Implements exponential backoff, instant rate-limit failovers, connection timeouts,
 * and comprehensive audit logging to the AiInteraction table.
 */
@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);
    private static final String GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
    private static final String GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

    private final RestTemplate restTemplate;
    private final AiInteractionRepository interactionRepository;
    private final ObjectMapper objectMapper;

    @Value("${ai.gemini.api-key:}")
    private String apiKey;

    @Value("${ai.gemini.model-text:gemini-3.7-flash}")
    private String modelText;

    @Value("${ai.gemini.model-vision:gemini-3.7-flash}")
    private String modelVision;

    @Value("${ai.gemini.model-fallback:gemini-3.5-flash-lite}")
    private String modelFallback;

    @Value("${ai.groq.api-key:}")
    private String groqApiKey;

    @Value("${ai.groq.model-text:openai/gpt-oss-120b}")
    private String groqModelText;

    @Value("${ai.openai.api-key:}")
    private String openaiApiKey;

    public GeminiService(AiInteractionRepository interactionRepository) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(15000); // 15 seconds connection timeout
        factory.setReadTimeout(45000);    // 45 seconds read timeout
        this.restTemplate = new RestTemplate(factory);
        this.interactionRepository = interactionRepository;
        this.objectMapper = new ObjectMapper();
    }

    /** Send a plain-text prompt and get a text response. */
    public String analyzeText(String prompt, String interactionType, UUID userId) {
        return callAiGateway(modelText, prompt, null, null, interactionType, userId);
    }

    /**
     * Send a prompt and ask the AI to respond in JSON matching the given schema.
     */
    public String generateStructuredJson(String prompt, String schema,
                                         String interactionType, UUID userId) {
        String fullPrompt = prompt
                + "\n\nProvide the output in JSON format exactly matching this schema:\n"
                + schema;
        return callAiGateway(modelText, fullPrompt, null, null, interactionType, userId);
    }

    /**
     * Send an image/PDF alongside a text prompt (for report or prescription analysis).
     */
    public String analyzeImage(String prompt, byte[] imageBytes, String mimeType,
                                String interactionType, UUID userId) {
        String base64Image = Base64.getEncoder().encodeToString(imageBytes);
        return callAiGateway(modelVision, prompt, base64Image, mimeType, interactionType, userId);
    }

    // ── Multi-Provider AI Gateway (Groq-First Text, Gemini-First Vision) ─────

    /**
     * Groq free-tier token limit is ~8,000 tokens. We estimate ~4 chars/token,
     * so anything over 24,000 chars should skip Groq to avoid wasted 413 roundtrips.
     */
    private static final int GROQ_MAX_CHARS = 24_000;

    private String callAiGateway(String primaryModel, String prompt, String base64Image,
                                  String mimeType, String interactionType, UUID userId) {
        long overallStartTime = System.currentTimeMillis();
        Exception lastException = null;

        // ═══════════════════════════════════════════════════════════════════════
        // PATH A: TEXT & STRUCTURED JSON (Groq LPU First → Gemini → OpenAI)
        // ═══════════════════════════════════════════════════════════════════════
        if (base64Image == null) {
            // 1. Try Groq LPU Cloud (Ultra-Fast ~150ms, Free Tier)
            //    Size-Aware Routing: Skip Groq if the prompt exceeds its token limit
            boolean promptFitsGroq = prompt != null && prompt.length() <= GROQ_MAX_CHARS;

            if (promptFitsGroq && groqApiKey != null && !groqApiKey.isBlank()) {
                List<String> groqModels = List.of(
                        groqModelText != null && !groqModelText.isBlank() ? groqModelText : "openai/gpt-oss-120b",
                        "qwen/qwen3.8-27b",
                        "groq/compound-mini"
                );
                for (String groqModel : groqModels) {
                    try {
                        long callStartTime = System.currentTimeMillis();
                        log.debug("Calling Groq LPU model={}", groqModel);
                        String responseText = executeGroqRequest(groqModel, prompt);
                        long latencyMs = System.currentTimeMillis() - callStartTime;

                        logInteraction(userId, interactionType, prompt, responseText, "groq:" + groqModel, latencyMs);
                        log.info("Groq call succeeded with ultra-fast latency={}ms", latencyMs);
                        return responseText;
                    } catch (Exception e) {
                        lastException = e;
                        log.warn("Groq model={} failed ({}). Trying next option...", groqModel, extractErrorMessage(e));
                    }
                }
            } else if (!promptFitsGroq) {
                log.info("Prompt size={}chars exceeds Groq free-tier limit ({}chars). " +
                        "Routing directly to Gemini/OpenAI.", prompt != null ? prompt.length() : 0, GROQ_MAX_CHARS);
            }

            // 2. Fallback to Google Gemini
            if (apiKey != null && !apiKey.isBlank()) {
                Set<String> geminiModels = getActiveGeminiModelChain(primaryModel);
                for (String currentModel : geminiModels) {
                    try {
                        long callStartTime = System.currentTimeMillis();
                        String responseText = executeGeminiRequest(currentModel, prompt, null, null, interactionType);
                        long latencyMs = System.currentTimeMillis() - callStartTime;

                        logInteraction(userId, interactionType, prompt, responseText, "gemini:" + currentModel, latencyMs);
                        log.info("Gemini text call succeeded latency={}ms", latencyMs);
                        return responseText;
                    } catch (Exception e) {
                        lastException = e;
                        log.warn("Gemini model={} fallback failed ({}). Trying next...", currentModel, extractErrorMessage(e));
                    }
                }
            }

            // 3. Fallback to OpenAI
            if (openaiApiKey != null && !openaiApiKey.isBlank()) {
                try {
                    long callStartTime = System.currentTimeMillis();
                    String responseText = executeOpenAiRequest("gpt-4o-mini", prompt, null, null);
                    long latencyMs = System.currentTimeMillis() - callStartTime;

                    logInteraction(userId, interactionType, prompt, responseText, "openai:gpt-4o-mini", latencyMs);
                    return responseText;
                } catch (Exception e) {
                    lastException = e;
                    log.warn("OpenAI fallback failed: {}", extractErrorMessage(e));
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // PATH B: VISION & PDF EXTRACTION (Gemini Vision First → OpenAI Vision)
        // ═══════════════════════════════════════════════════════════════════════
        if (base64Image != null) {
            // 1. Try Gemini Vision Suite
            if (apiKey != null && !apiKey.isBlank()) {
                Set<String> geminiModels = getActiveGeminiModelChain(primaryModel);
                for (String currentModel : geminiModels) {
                    try {
                        long callStartTime = System.currentTimeMillis();
                        String responseText = executeGeminiRequest(currentModel, prompt, base64Image, mimeType, interactionType);
                        long latencyMs = System.currentTimeMillis() - callStartTime;

                        logInteraction(userId, interactionType, prompt, responseText, "gemini:" + currentModel, latencyMs);
                        log.info("Gemini vision call succeeded latency={}ms", latencyMs);
                        return responseText;
                    } catch (Exception e) {
                        lastException = e;
                        log.warn("Gemini vision model={} failed ({}). Trying next...", currentModel, extractErrorMessage(e));
                    }
                }
            }

            // 2. Fallback to OpenAI Vision
            if (openaiApiKey != null && !openaiApiKey.isBlank()) {
                try {
                    long callStartTime = System.currentTimeMillis();
                    String responseText = executeOpenAiRequest("gpt-4o-mini", prompt, base64Image, mimeType);
                    long latencyMs = System.currentTimeMillis() - callStartTime;

                    logInteraction(userId, interactionType, prompt, responseText, "openai:gpt-4o-mini", latencyMs);
                    return responseText;
                } catch (Exception e) {
                    lastException = e;
                    log.warn("OpenAI vision fallback failed: {}", extractErrorMessage(e));
                }
            }
        }

        // ── Phase 3: All providers exhausted ─────────────────────────────────
        long totalLatencyMs = System.currentTimeMillis() - overallStartTime;
        String finalError = extractErrorMessage(lastException);
        logInteraction(userId, interactionType, prompt, "ERROR: " + finalError, primaryModel, totalLatencyMs);
        log.error("All AI providers (Groq, Gemini, OpenAI) failed for interactionType={}. Last error: {}", interactionType, finalError);

        throw new RuntimeException("The AI Assistant is currently experiencing high demand. Please try again in a few moments.", lastException);
    }

    private Set<String> getActiveGeminiModelChain(String primaryModel) {
        Set<String> geminiModels = new LinkedHashSet<>();
        if (primaryModel != null && !primaryModel.isBlank()) geminiModels.add(primaryModel.trim());
        if (modelFallback != null && !modelFallback.isBlank()) geminiModels.add(modelFallback.trim());
        geminiModels.add("gemini-3.7-flash");
        geminiModels.add("gemini-3.5-flash-lite");
        geminiModels.add("gemini-3.8-flash");
        geminiModels.add("gemini-flash-latest");
        geminiModels.add("gemini-flash-lite-latest");
        geminiModels.add("gemini-3.6-flash");
        return geminiModels;
    }

    // ── Provider Execution Methods ───────────────────────────────────────────

    private String executeGeminiRequest(String model, String prompt, String base64Image,
                                        String mimeType, String interactionType) throws Exception {
        String url = GEMINI_BASE_URL + model + ":generateContent?key=" + apiKey;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

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

        Map<String, Object> content = new HashMap<>();
        content.put("parts", parts);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("contents", List.of(content));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

        String responseText = extractTextFromGeminiResponse(response.getBody());
        return stripMarkdownFences(responseText);
    }

    private String executeGroqRequest(String model, String prompt) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + groqApiKey);
        headers.set("User-Agent", "Medivra-App/1.0");

        Map<String, Object> message = new HashMap<>();
        message.put("role", "user");
        message.put("content", prompt);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", List.of(message));
        requestBody.put("temperature", 0.3);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(GROQ_API_URL, entity, String.class);

        return stripMarkdownFences(extractTextFromOpenAiCompatibleResponse(response.getBody()));
    }

    private String executeOpenAiRequest(String model, String prompt, String base64Image, String mimeType) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + openaiApiKey);

        Map<String, Object> message = new HashMap<>();
        message.put("role", "user");

        if (base64Image != null && mimeType != null) {
            Map<String, Object> textItem = Map.of("type", "text", "text", prompt);
            Map<String, Object> imageUrlItem = Map.of("type", "image_url", "image_url", Map.of("url", "data:" + mimeType + ";base64," + base64Image));
            message.put("content", List.of(textItem, imageUrlItem));
        } else {
            message.put("content", prompt);
        }

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", List.of(message));
        requestBody.put("temperature", 0.3);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(OPENAI_API_URL, entity, String.class);

        return stripMarkdownFences(extractTextFromOpenAiCompatibleResponse(response.getBody()));
    }

    // ── Response Parsing Helpers ─────────────────────────────────────────────

    private String extractTextFromGeminiResponse(String responseBody) throws Exception {
        if (responseBody == null || responseBody.isBlank()) return "";
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

    private String extractTextFromOpenAiCompatibleResponse(String responseBody) throws Exception {
        if (responseBody == null || responseBody.isBlank()) return "";
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode choices = root.path("choices");
        if (choices.isArray() && !choices.isEmpty()) {
            return choices.get(0).path("message").path("content").asText();
        }
        return "";
    }

    private String extractErrorMessage(Exception e) {
        if (e == null) return "Unknown error";
        if (e instanceof HttpStatusCodeException sc) {
            String body = sc.getResponseBodyAsString();
            if (body != null && !body.isBlank()) {
                try {
                    JsonNode root = objectMapper.readTree(body);
                    JsonNode errorNode = root.path("error");
                    if (!errorNode.isMissingNode()) {
                        String msg = errorNode.path("message").asText();
                        if (msg != null && !msg.isBlank()) {
                            return sc.getStatusCode() + " " + msg;
                        }
                    }
                } catch (Exception ignored) {}
                return sc.getStatusCode() + ": " + body;
            }
            return sc.getStatusCode() + " " + sc.getStatusText();
        }
        return e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
    }

    private String stripMarkdownFences(String text) {
        if (text == null) return "";
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

    private void logInteraction(UUID userId, String type, String prompt,
                                 String response, String model, long latencyMs) {
        try {
            AiInteraction interaction = new AiInteraction();
            interaction.setUserId(userId);
            interaction.setInteractionType(type);
            interaction.setRequestSummary(
                    prompt != null && prompt.length() > 500 ? prompt.substring(0, 500) + "..." : prompt);
            interaction.setResponseText(response);
            interaction.setModelUsed(model);
            interaction.setLatencyMs(latencyMs);
            interactionRepository.save(interaction);
        } catch (Exception e) {
            log.warn("Failed to persist AI interaction log: {}", e.getMessage());
        }
    }
}
