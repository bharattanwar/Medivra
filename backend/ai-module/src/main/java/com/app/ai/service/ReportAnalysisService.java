package com.app.ai.service;

import com.app.ai.dto.ReportAnalysisRequest;
import com.app.ai.dto.ReportAnalysisResponse;
import com.app.ai.entity.AiReportSummary;
import com.app.ai.entity.MedicalReport;
import com.app.ai.repository.AiReportSummaryRepository;
import com.app.ai.repository.MedicalReportRepository;
import com.app.record.service.FileStorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import com.app.common.event.NotificationEvent;
import com.app.common.entity.NotificationType;
import org.springframework.context.ApplicationEventPublisher;

import java.io.InputStream;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

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
        String originalFilename = file.getOriginalFilename();
        String contentType = file.getContentType();

        // 1. Save file
        String filePath = fileStorageService.save(file);

        // 2. Create MedicalReport entity
        MedicalReport report = new MedicalReport();
        report.setPatientId(request.getPatientId());
        report.setReportType(request.getReportType());
        report.setFilePath(filePath);
        report.setFileType(contentType);
        report.setOriginalFileName(originalFilename);
        report = medicalReportRepository.save(report);

        // 3. Extract text/data
        String extractedText = "";
        String aiResponse = "";
        try {
            if (contentType != null && contentType.equals("application/pdf")) {
                extractedText = extractTextFromPdf(file.getInputStream());
                aiResponse = callGeminiForText(extractedText, request.getReportType(), request.getPatientId());
            } else if (contentType != null && contentType.startsWith("image/")) {
                aiResponse = callGeminiForImage(file.getBytes(), contentType, request.getReportType(), request.getPatientId());
            } else {
                throw new RuntimeException("Unsupported file type: " + contentType);
            }

            // 4. Parse AI JSON Response
            JsonNode rootNode = objectMapper.readTree(aiResponse);
            
            AiReportSummary summary = new AiReportSummary();
            summary.setReportId(report.getId());
            summary.setSummaryText(rootNode.path("summary").asText());
            summary.setAbnormalFindings(rootNode.path("abnormalValues").toString());
            summary.setNormalFindings(rootNode.path("normalValues").toString());
            summary.setSuggestedQuestions(rootNode.path("suggestedQuestions").toString());
            summary.setRecommendedFollowUps(rootNode.path("recommendedFollowUps").toString());
            summary.setConfidenceLevel(rootNode.path("confidenceLevel").asText());
            summary.setRawAiResponse(aiResponse);

            summaryRepository.save(summary);

            return mapToResponse(report, summary);
        } catch (Exception e) {
            throw new RuntimeException("Failed to analyze report: " + e.getMessage(), e);
        }
    }

    private String extractTextFromPdf(InputStream inputStream) throws Exception {
        try (PDDocument document = PDDocument.load(inputStream)) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        }
    }

    private String callGeminiForText(String text, String reportType, UUID patientId) {
        String prompt = "You are an AI Medical Assistant. Analyze the following extracted text from a " + reportType + " medical report.\n" +
                "Text:\n" + text + "\n\n" +
                "IMPORTANT DISCLAIMER: Add a disclaimer that this is educational information only, not a medical diagnosis.";
        String schema = getAiSchema();
        return geminiService.generateStructuredJson(prompt, schema, "REPORT_ANALYSIS", patientId);
    }

    private String callGeminiForImage(byte[] imageBytes, String mimeType, String reportType, UUID patientId) {
        String prompt = "You are an AI Medical Assistant. Analyze the attached image of a " + reportType + " medical report.\n" +
                "IMPORTANT DISCLAIMER: Add a disclaimer that this is educational information only, not a medical diagnosis.\n" +
                "Provide the output in JSON format exactly matching this schema:\n" + getAiSchema();
        
        String response = geminiService.analyzeImage(prompt, imageBytes, mimeType, "REPORT_ANALYSIS", patientId);
        
        // Clean up markdown block if present
        if (response.startsWith("```json")) {
            response = response.substring(7);
            if (response.endsWith("```")) {
                response = response.substring(0, response.length() - 3);
            }
        }
        return response.trim();
    }

    private String getAiSchema() {
        return "{\n" +
                "  \"summary\": \"Plain language explanation of the report, including the educational disclaimer\",\n" +
                "  \"abnormalValues\": [\"List of abnormal findings with explanation of what they mean\"],\n" +
                "  \"normalValues\": [\"List of normal findings\"],\n" +
                "  \"suggestedQuestions\": [\"Questions the patient should ask their doctor based on this report\"],\n" +
                "  \"recommendedFollowUps\": [\"Any follow-up tests or actions mentioned in the report or recommended based on findings\"],\n" +
                "  \"confidenceLevel\": \"HIGH, MEDIUM, or LOW\"\n" +
                "}";
    }

    public ReportAnalysisResponse getReportSummary(UUID reportId) {
        MedicalReport report = medicalReportRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("Report not found"));
        AiReportSummary summary = summaryRepository.findByReportId(reportId)
                .orElseThrow(() -> new RuntimeException("Summary not found"));
        return mapToResponse(report, summary);
    }

    public List<ReportAnalysisResponse> getReportsByPatient(UUID patientId) {
        List<MedicalReport> reports = medicalReportRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
        return reports.stream().map(report -> {
            AiReportSummary summary = summaryRepository.findByReportId(report.getId()).orElse(null);
            return mapToResponse(report, summary);
        }).collect(Collectors.toList());
    }

    @Transactional
    public void deleteReport(UUID reportId) {
        MedicalReport report = medicalReportRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("Report not found"));

        // Delete summary first to respect constraints
        summaryRepository.findByReportId(reportId).ifPresent(summaryRepository::delete);

        // Delete local file
        if (report.getFilePath() != null) {
            try {
                java.nio.file.Files.deleteIfExists(java.nio.file.Paths.get("uploads").resolve(report.getFilePath()));
            } catch (Exception e) {
                // Ignore file system delete failures so DB transaction succeeds
            }
        }

        // Delete medical report entity
        medicalReportRepository.delete(report);
    }

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
