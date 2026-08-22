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
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.List;
import java.util.UUID;
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
 * Images are sent inline as base-64 for Gemini's vision model.
 */
@Service
public class ReportAnalysisService {

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
            if ("application/pdf".equals(contentType)) {
                String text = extractTextFromPdf(file.getInputStream());
                aiResponse = callGeminiForText(text, request.getReportType(), request.getPatientId());
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
            return new PDFTextStripper().getText(document);
        }
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
                + "  \"abnormalValues\": [\"List of abnormal findings with explanation of what they mean\"],\n"
                + "  \"normalValues\": [\"List of normal findings\"],\n"
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
