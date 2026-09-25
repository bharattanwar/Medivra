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
    private final com.app.record.service.DeterministicLabService deterministicLabService;

    public ReportAnalysisService(MedicalReportRepository medicalReportRepository,
                                 AiReportSummaryRepository summaryRepository,
                                 FileStorageService fileStorageService,
                                 GeminiService geminiService,
                                 ApplicationEventPublisher eventPublisher,
                                 com.app.record.service.DeterministicLabService deterministicLabService) {
        this.medicalReportRepository = medicalReportRepository;
        this.summaryRepository = summaryRepository;
        this.fileStorageService = fileStorageService;
        this.geminiService = geminiService;
        this.objectMapper = new ObjectMapper();
        this.eventPublisher = eventPublisher;
        this.deterministicLabService = deterministicLabService;
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

            // Auto-ingest structured parameters into DeterministicLabService for exact trending
            try {
                com.app.record.dto.IngestLabParametersRequest ingestReq = new com.app.record.dto.IngestLabParametersRequest();
                ingestReq.setReportId(report.getId());
                ingestReq.setPatientId(request.getPatientId());
                ingestReq.setTestCategory(request.getReportType());
                ingestReq.setTestDate(java.time.LocalDate.now());
                ingestReq.setIsHealthJourneyFulfillment(request.getIsHealthJourneyFulfillment());
                ingestReq.setLinkedLabTestId(request.getLinkedLabTestId());
                ingestReq.setLinkedTaskId(request.getLinkedTaskId());

                List<com.app.record.dto.IngestLabParametersRequest.LabParameterInput> paramInputs = new java.util.ArrayList<>();
                
                // Parse abnormal values
                JsonNode abnormalNode = root.path("abnormalValues");
                if (abnormalNode.isArray()) {
                    for (JsonNode item : abnormalNode) {
                        String rawPName = item.path("parameter").asText();
                        String pName = cleanParamName(rawPName);
                        if (!pName.isBlank()) {
                            com.app.record.dto.IngestLabParametersRequest.LabParameterInput pi = new com.app.record.dto.IngestLabParametersRequest.LabParameterInput();
                            pi.setParameterName(pName);
                            pi.setRawValue(item.path("value").asText());
                            pi.setReferenceRangeText(item.path("range").asText());
                            pi.setFlag("HIGH");
                            paramInputs.add(pi);
                        }
                    }
                }

                // Parse normal values (supports both structured objects and legacy strings)
                JsonNode normalNode = root.path("normalValues");
                if (normalNode.isArray()) {
                    for (JsonNode item : normalNode) {
                        if (item.isObject()) {
                            String rawPName = item.path("parameter").asText();
                            String pName = cleanParamName(rawPName);
                            if (!pName.isBlank()) {
                                com.app.record.dto.IngestLabParametersRequest.LabParameterInput pi = new com.app.record.dto.IngestLabParametersRequest.LabParameterInput();
                                pi.setParameterName(pName);
                                pi.setRawValue(item.path("value").asText());
                                pi.setReferenceRangeText(item.path("range").asText());
                                pi.setFlag("NORMAL");
                                paramInputs.add(pi);
                            }
                        } else {
                            String textVal = item.asText();
                            if (textVal != null && !textVal.isBlank()) {
                                String[] parts = textVal.split("[:—\\-–]");
                                String rawPName = parts[0];
                                if (rawPName.equalsIgnoreCase("CBC") || rawPName.toLowerCase().contains("blood count") || rawPName.toLowerCase().contains("panel")) {
                                    rawPName = parts.length > 1 ? parts[1] : textVal;
                                }
                                String pName = cleanParamName(rawPName);
                                if (!pName.isBlank()) {
                                    com.app.record.dto.IngestLabParametersRequest.LabParameterInput pi = new com.app.record.dto.IngestLabParametersRequest.LabParameterInput();
                                    pi.setParameterName(pName);
                                    pi.setRawValue(parts.length > 2 ? parts[2].trim() : (parts.length > 1 ? parts[1].trim() : textVal.trim()));
                                    pi.setFlag("NORMAL");
                                    paramInputs.add(pi);
                                }
                            }
                        }
                    }
                }

                if (!paramInputs.isEmpty()) {
                    ingestReq.setParameters(paramInputs);
                    deterministicLabService.ingestParameters(ingestReq);
                }
            } catch (Exception paramEx) {
                log.warn("Failed to auto-ingest structured lab parameters: {}", paramEx.getMessage());
            }

            return mapToResponse(report, summary);

        } catch (Exception e) {
            throw new RuntimeException("Failed to analyze report: " + e.getMessage(), e);
        }
    }

    private String cleanParamName(String rawName) {
        if (rawName == null) return "";
        String cleaned = rawName.trim();
        // Strip leading prefixes like "CBC: ", "CBC - ", "Complete Blood Count - ", etc.
        cleaned = cleaned.replaceAll("(?i)^(CBC|Complete Blood Count|Blood Test|Lipid Panel|LFT|KFT|RFT|Thyroid Profile)\\s*[:\\-–—]\\s*", "");
        return cleaned.trim();
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
        String prompt = "You are an expert AI Clinical Laboratory Diagnostic Assistant. Analyze the provided medical report (" + reportType + ").\n\n"
                + "CRITICAL EXTRACTION REQUIREMENTS:\n"
                + "1. COMPREHENSIVE EXTRACTION: You MUST extract ALL measured numerical and qualitative parameters found in the report. Do NOT summarize or skip routine parameters.\n"
                + "2. CLEAN PARAMETER NAMES: Extract individual test parameter names (e.g. 'Hemoglobin', 'Total Leukocyte Count (TLC)', 'Platelets', 'Neutrophils', 'Lymphocytes', 'Serum Creatinine', 'Bilirubin - Total', 'SGOT / AST', 'Fasting Blood Glucose', 'HbA1c').\n"
                + "   DO NOT prefix the parameter name with the general report header or acronym (e.g., do NOT write 'CBC: Hemoglobin' or 'CBC - TLC'; write 'Hemoglobin' and 'Total Leukocyte Count (TLC)').\n"
                + "3. SEPARATION:\n"
                + "   - Place any out-of-reference-range or flagged findings in 'abnormalValues'.\n"
                + "   - Place all in-range / normal findings in 'normalValues'.\n"
                + "4. UNITS & RANGES: Always capture the exact numerical value, unit, and standard biological reference range.\n\n"
                + "IMPORTANT DISCLAIMER: Add a disclaimer that this is educational information only, not a medical diagnosis.\n\n"
                + "Report Content:\n" + text;
        return geminiService.generateStructuredJson(
                prompt, getAiSchema(), "REPORT_ANALYSIS", patientId);
    }

    /** Build an image-based Gemini prompt (raw bytes forwarded to the vision model). */
    private String callGeminiForImage(byte[] imageBytes, String mimeType,
                                       String reportType, UUID patientId) {
        String prompt = "You are an expert AI Clinical Laboratory Diagnostic Assistant. Analyze the attached medical report image (" + reportType + ").\n\n"
                + "CRITICAL EXTRACTION REQUIREMENTS:\n"
                + "1. COMPREHENSIVE EXTRACTION: Extract EVERY tested parameter from the report table into either 'abnormalValues' or 'normalValues'. Do NOT skip any rows.\n"
                + "2. CLEAN PARAMETER NAMES: Use clean individual test names without prefixing 'CBC' or report titles.\n"
                + "3. UNITS & RANGES: Capture exact value with unit and reference intervals.\n\n"
                + "IMPORTANT DISCLAIMER: Add a disclaimer that this is educational information only, not a medical diagnosis.\n"
                + "Provide the output in JSON format exactly matching this schema:\n"
                + getAiSchema();
        return geminiService.analyzeImage(
                prompt, imageBytes, mimeType, "REPORT_ANALYSIS", patientId);
    }

    /** JSON schema sent to Gemini so it knows exactly what shape to return. */
    private String getAiSchema() {
        return "{\n"
                + "  \"summary\": \"Comprehensive plain language explanation of all report findings, including educational disclaimer\",\n"
                + "  \"abnormalValues\": [\n"
                + "    {\n"
                + "      \"parameter\": \"Specific test parameter name (e.g. Hemoglobin, Total Leukocytes, Platelet Count, Serum Creatinine)\",\n"
                + "      \"value\": \"Measured value with unit (e.g. 9.8 g/dL, 14,500 /µL, 1.8 mg/dL)\",\n"
                + "      \"range\": \"Reference range with unit (e.g. 12.0-15.5 g/dL, 4,000-11,000 /µL, 0.7-1.3 mg/dL)\",\n"
                + "      \"significance\": \"Clinical significance in simple plain words\"\n"
                + "    }\n"
                + "  ],\n"
                + "  \"normalValues\": [\n"
                + "    {\n"
                + "      \"parameter\": \"Specific test parameter name (e.g. RBC Count, Neutrophils, Lymphocytes, SGOT, Total Bilirubin)\",\n"
                + "      \"value\": \"Measured value with unit (e.g. 4.6 mill/cumm, 62%, 28 U/L)\",\n"
                + "      \"range\": \"Reference range with unit (e.g. 4.0-5.2 mill/cumm, 40-75%, < 35 U/L)\"\n"
                + "    }\n"
                + "  ],\n"
                + "  \"suggestedQuestions\": [\"Questions the patient should ask their doctor based on this report\"],\n"
                + "  \"recommendedFollowUps\": [\"Recommended follow-up actions or monitoring based on findings\"],\n"
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
