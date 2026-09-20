package com.app.ai.service;

import com.app.ai.dto.ReportAnalysisRequest;
import com.app.ai.dto.ReportAnalysisResponse;
import com.app.ai.entity.AiReportSummary;
import com.app.ai.entity.MedicalReport;
import com.app.ai.repository.AiReportSummaryRepository;
import com.app.ai.repository.MedicalReportRepository;
import com.app.record.service.FileStorageService;
import com.app.common.event.NotificationEvent;
import com.app.common.entity.NotificationType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Handles AI-powered analysis of uploaded medical reports (PDFs and images).
 *
 * Flow:
 *   1. Save the uploaded file to disk via FileStorageService.
 *   2. Extract text (PDF) or send the raw image bytes (image) to Gemini.
 *   3. Parse the JSON response and persist an AiReportSummary.
 *   4. Return a response DTO the frontend can display directly.
 *
 * PDFs have text extracted first so the LLM gets clean, structured input.
 * Scanned PDFs (with no extractable text) fall back gracefully to Gemini vision.
 * Images are sent inline as base-64 for Gemini's vision model.
 */
@Service
public class ReportAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(ReportAnalysisService.class);

    private final MedicalReportRepository medicalReportRepository;
    private final AiReportSummaryRepository summaryRepository;
    private final FileStorageService fileStorageService;
    private final GeminiService geminiService;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    public ReportAnalysisService(MedicalReportRepository medicalReportRepository,
                                 AiReportSummaryRepository summaryRepository,
                                 FileStorageService fileStorageService,
                                 GeminiService geminiService,
                                 ApplicationEventPublisher eventPublisher) {
        this.medicalReportRepository = medicalReportRepository;
        this.summaryRepository = summaryRepository;
        this.fileStorageService = fileStorageService;
        this.geminiService = geminiService;
        this.objectMapper = new ObjectMapper();
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public ReportAnalysisResponse analyzeReport(ReportAnalysisRequest request) {
        MultipartFile file = request.getFile();
        String contentType = file.getContentType();

        // 1. Persist the file and record metadata
        String filePath = fileStorageService.save(file);

        MedicalReport report = new MedicalReport();
        report.setPatientId(request.getPatientId());
        report.setReportType(request.getReportType());
        report.setFilePath(filePath);
        report.setFileType(contentType);
        report.setOriginalFileName(file.getOriginalFilename());
        report = medicalReportRepository.save(report);

        try {
            // 2. Call Gemini — different path for PDF vs image
            String aiResponse;
            if ("application/pdf".equalsIgnoreCase(contentType)) {
                String text = "";
                try {
                    text = extractTextFromPdf(file.getInputStream());
                } catch (Exception pdfEx) {
                    log.warn("Failed to extract text from PDF: {}", pdfEx.getMessage());
                }

                if (text != null && text.trim().length() >= 30) {
                    aiResponse = callGeminiForText(text, request.getReportType(), request.getPatientId());
                } else {
                    // Scanned PDF fallback to Gemini Vision
                    log.info("PDF has minimal or no selectable text; falling back to Gemini Vision for PDF bytes");
                    aiResponse = callGeminiForImage(file.getBytes(), "application/pdf", request.getReportType(), request.getPatientId());
                }
            } else if (contentType != null && contentType.startsWith("image/")) {
                aiResponse = callGeminiForImage(
                        file.getBytes(), contentType,
                        request.getReportType(), request.getPatientId());
            } else {
                throw new RuntimeException("Unsupported file type: " + contentType);
            }

            // 3. Parse and store the AI summary
            JsonNode root = objectMapper.readTree(aiResponse);

            AiReportSummary summary = new AiReportSummary();
            summary.setReportId(report.getId());
            summary.setSummaryText(root.path("summary").asText());
            summary.setAbnormalFindings(root.path("abnormalValues").toString());
            summary.setNormalFindings(root.path("normalValues").toString());
            summary.setSuggestedQuestions(root.path("suggestedQuestions").toString());
            summary.setRecommendedFollowUps(root.path("recommendedFollowUps").toString());
            summary.setConfidenceLevel(root.path("confidenceLevel").asText());
            summary.setRawAiResponse(aiResponse);
            summaryRepository.save(summary);

            return mapToResponse(report, summary);

        } catch (Exception e) {
            throw new RuntimeException("Failed to analyze report: " + e.getMessage(), e);
        }
    }

    // ── Query methods ────────────────────────────────────────────────────────

    public ReportAnalysisResponse getReportSummary(UUID reportId) {
        MedicalReport report = medicalReportRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("Report not found"));
        AiReportSummary summary = summaryRepository.findByReportId(reportId)
                .orElseThrow(() -> new RuntimeException("Summary not found"));
        return mapToResponse(report, summary);
    }

    public List<ReportAnalysisResponse> getReportsByPatient(UUID patientId) {
        return medicalReportRepository
                .findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .map(report -> {
                    AiReportSummary summary = summaryRepository
                            .findByReportId(report.getId()).orElse(null);
                    return mapToResponse(report, summary);
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteReport(UUID reportId) {
        MedicalReport report = medicalReportRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("Report not found"));

        // Remove summary first (foreign key constraint)
        summaryRepository.findByReportId(reportId)
                .ifPresent(summaryRepository::delete);

        // Best-effort file deletion — don't fail the transaction if the file is missing
        if (report.getFilePath() != null) {
            try {
                java.nio.file.Files.deleteIfExists(
                        java.nio.file.Paths.get("uploads").resolve(report.getFilePath()));
            } catch (Exception ignored) {
                // File removal is non-critical; the DB record is what matters
            }
        }

        medicalReportRepository.delete(report);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /** Use PDFBox to pull raw text from a PDF so Gemini gets clean structured input. */
    private String extractTextFromPdf(InputStream inputStream) throws Exception {
        try (PDDocument document = PDDocument.load(inputStream)) {
            String rawText = new PDFTextStripper().getText(document);
            return normalizeWhitespace(rawText);
        }
    }

    // ── Conservative Text Normalization ──────────────────────────────────────
    // IMPORTANT: For medical reports, 100% accuracy is NON-NEGOTIABLE.
    // We NEVER strip, skip, or remove any text lines — only normalize whitespace.
    //
    // The primary defense against Groq's free-tier 8K token limit is SIZE-AWARE
    // ROUTING in GeminiService (which skips Groq for large prompts and routes
    // directly to Gemini/OpenAI with 1M+ token context windows).
    //
    // Clinical findings like USG/BIRADS scores, leukocyte counts, echocardiography
    // results, cervical cytology, etc. must NEVER be dropped.

    private static final Pattern MULTI_BLANK_LINES = Pattern.compile("\\n{3,}");
    private static final Pattern TRAILING_SPACES = Pattern.compile("[ \\t]+$", Pattern.MULTILINE);

    /**
     * Ultra-conservative text normalization — preserves ALL clinical content:
     *   1. Collapse 3+ consecutive blank lines → 2 blank lines
     *   2. Trim trailing whitespace from each line
     *   3. That's it. No content is ever removed or truncated.
     *
     * This typically achieves ~10-15% size reduction from whitespace alone
     * without any risk of losing clinical findings.
     */
    private String normalizeWhitespace(String rawText) {
        if (rawText == null || rawText.isBlank()) return rawText;

        String result = rawText;

        // Only collapse excessive blank lines (3+ → 2)
        result = MULTI_BLANK_LINES.matcher(result).replaceAll("\n\n");

        // Trim trailing whitespace per line (keeps all actual text intact)
        result = TRAILING_SPACES.matcher(result).replaceAll("");

        int reduction = rawText.length() > 0
                ? (100 - (result.length() * 100 / rawText.length())) : 0;
        if (reduction > 0) {
            log.info("Text normalization: {} chars → {} chars ({}% whitespace reduction, zero content removed)",
                    rawText.length(), result.length(), reduction);
        }

        return result.trim();
    }

    /** Build a text-based Gemini prompt for extracted PDF content. */
    private String callGeminiForText(String text, String reportType, UUID patientId) {
        String prompt = "You are an AI Medical Assistant. Analyze the following extracted text "
                + "from a " + reportType + " medical report.\nText:\n" + text + "\n\n"
                + "IMPORTANT DISCLAIMER: Add a disclaimer that this is educational information "
                + "only, not a medical diagnosis.";
        return geminiService.generateStructuredJson(
                prompt, getAiSchema(), "REPORT_ANALYSIS", patientId);
    }

    /** Build an image-based Gemini prompt (raw bytes forwarded to the vision model). */
    private String callGeminiForImage(byte[] imageBytes, String mimeType,
                                       String reportType, UUID patientId) {
        String prompt = "You are an AI Medical Assistant. Analyze the attached image of a "
                + reportType + " medical report.\n"
                + "IMPORTANT DISCLAIMER: Add a disclaimer that this is educational information "
                + "only, not a medical diagnosis.\n"
                + "Provide the output in JSON format exactly matching this schema:\n"
                + getAiSchema();
        return geminiService.analyzeImage(
                prompt, imageBytes, mimeType, "REPORT_ANALYSIS", patientId);
    }

    /** JSON schema sent to Gemini so it knows exactly what shape to return. */
    private String getAiSchema() {
        return "{\n"
                + "  \"summary\": \"Plain language explanation of the report, including the educational disclaimer\",\n"
                + "  \"abnormalValues\": [\n"
                + "    {\n"
                + "      \"parameter\": \"Test or finding name (e.g. WBC Count, BIRADS, LDL Cholesterol)\",\n"
                + "      \"value\": \"The actual measured value with unit (e.g. 14,330 /µL, Grade 1, 4.6 x 10.5 mm)\",\n"
                + "      \"range\": \"Normal reference range with unit (e.g. 4,000-10,000 /µL, N/A for imaging)\",\n"
                + "      \"significance\": \"Brief clinical significance in simple words (e.g. may suggest infection or inflammation)\"\n"
                + "    }\n"
                + "  ],\n"
                + "  \"normalValues\": [\"List of normal findings as concise strings e.g. HbA1c 5.5% (4.0-5.6) — normal\"],\n"
                + "  \"suggestedQuestions\": [\"Questions the patient should ask their doctor based on this report\"],\n"
                + "  \"recommendedFollowUps\": [\"Any follow-up tests or actions mentioned in the report or recommended based on findings\"],\n"
                + "  \"confidenceLevel\": \"HIGH, MEDIUM, or LOW\"\n"
                + "}";
    }

    /** Map entity pair → response DTO. Summary fields are optional (null-safe). */
    private ReportAnalysisResponse mapToResponse(MedicalReport report, AiReportSummary summary) {
        ReportAnalysisResponse response = new ReportAnalysisResponse();
        response.setReportId(report.getId());
        response.setPatientId(report.getPatientId());
        response.setReportType(report.getReportType());
        if (summary != null) {
            response.setSummaryText(summary.getSummaryText());
            response.setAbnormalFindings(summary.getAbnormalFindings());
            response.setNormalFindings(summary.getNormalFindings());
            response.setSuggestedQuestions(summary.getSuggestedQuestions());
            response.setRecommendedFollowUps(summary.getRecommendedFollowUps());
            response.setConfidenceLevel(summary.getConfidenceLevel());
            response.setAnalyzedAt(summary.getCreatedAt());
        }
        return response;
    }
}
