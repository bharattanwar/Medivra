package com.app.ai.service;

import com.app.pharmacy.service.importer.AiColumnMappingProvider;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.util.*;

/**
 * Implements AI-powered column mapping and PDF inventory extraction using Google Gemini.
 */
@Service
public class GeminiInventoryImportService implements AiColumnMappingProvider {

    private static final Logger log = LoggerFactory.getLogger(GeminiInventoryImportService.class);

    private final GeminiService geminiService;
    private final ObjectMapper objectMapper;

    public GeminiInventoryImportService(GeminiService geminiService) {
        this.geminiService = geminiService;
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public Map<String, String> inferColumnMappings(List<String> headers, List<List<String>> sampleRows) {
        try {
            String prompt = String.format(
                    "You are an AI healthcare inventory specialist. A pharmacy uploaded a file with custom column headers:\n" +
                    "Headers: %s\n" +
                    "Sample Rows: %s\n\n" +
                    "Map these headers to the target fields: medicineName, strength, manufacturer, quantity, price, expiryDate.\n" +
                    "For each target field, output the EXACT header name from the headers list that corresponds to it.",
                    objectMapper.writeValueAsString(headers),
                    objectMapper.writeValueAsString(sampleRows.subList(0, Math.min(sampleRows.size(), 5)))
            );

            String schema = "{\n" +
                    "  \"medicineName\": \"exact matching header string or null\",\n" +
                    "  \"strength\": \"exact matching header string or null\",\n" +
                    "  \"manufacturer\": \"exact matching header string or null\",\n" +
                    "  \"quantity\": \"exact matching header string or null\",\n" +
                    "  \"price\": \"exact matching header string or null\",\n" +
                    "  \"expiryDate\": \"exact matching header string or null\"\n" +
                    "}";

            String jsonResponse = geminiService.generateStructuredJson(prompt, schema, "INVENTORY_COLUMN_MAPPING", null);
            JsonNode root = objectMapper.readTree(jsonResponse);

            Map<String, String> mapping = new HashMap<>();
            Iterator<Map.Entry<String, JsonNode>> fields = root.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                if (entry.getValue() != null && !entry.getValue().isNull() && !entry.getValue().asText().isBlank()) {
                    String candidateHeader = entry.getValue().asText().trim();
                    // Verify header actually exists in original list
                    for (String h : headers) {
                        if (h.equalsIgnoreCase(candidateHeader)) {
                            mapping.put(entry.getKey(), h);
                            break;
                        }
                    }
                }
            }
            return mapping;

        } catch (Exception e) {
            log.warn("Gemini column mapping failed: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    @Override
    public List<Map<String, Object>> extractInventoryFromPdf(byte[] pdfBytes, String fileName) {
        try {
            // First extract raw text from PDF with PDFBox
            String pdfText = "";
            try (PDDocument document = PDDocument.load(new ByteArrayInputStream(pdfBytes))) {
                PDFTextStripper stripper = new PDFTextStripper();
                stripper.setSortByPosition(true);
                pdfText = stripper.getText(document);
            } catch (Exception e) {
                log.debug("PDFBox text extract before Gemini call: {}", e.getMessage());
            }

            String prompt;
            String jsonResponse;

            if (pdfText != null && !pdfText.isBlank()) {
                prompt = "Extract the complete pharmacy inventory items from the following raw PDF text:\n\n"
                        + pdfText + "\n\n"
                        + "Extract all medicines with their medicineName, strength, manufacturer, quantity (integer), and price (number).";

                String schema = "[\n" +
                        "  {\n" +
                        "    \"medicineName\": \"Paracetamol 650mg\",\n" +
                        "    \"strength\": \"650mg\",\n" +
                        "    \"manufacturer\": \"Micro Labs\",\n" +
                        "    \"quantity\": 100,\n" +
                        "    \"price\": 30.50,\n" +
                        "    \"expiryDate\": \"12/2026\"\n" +
                        "  }\n" +
                        "]";

                jsonResponse = geminiService.generateStructuredJson(prompt, schema, "PDF_INVENTORY_EXTRACTION", null);
            } else {
                // If scanned PDF, use Gemini Vision
                prompt = "Extract all pharmacy inventory items from this document image. For each item provide: medicineName, strength, manufacturer, quantity (integer), and price (number).";
                jsonResponse = geminiService.analyzeImage(prompt, pdfBytes, "application/pdf", "PDF_VISION_INVENTORY_EXTRACTION", null);
            }

            return objectMapper.readValue(jsonResponse, new TypeReference<List<Map<String, Object>>>() {});

        } catch (Exception e) {
            log.warn("Gemini PDF inventory extraction failed: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
}
