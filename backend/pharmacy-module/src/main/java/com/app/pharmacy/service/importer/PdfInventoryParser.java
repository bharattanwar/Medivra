package com.app.pharmacy.service.importer;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class PdfInventoryParser {

    private static final Logger log = LoggerFactory.getLogger(PdfInventoryParser.class);

    private final Optional<AiColumnMappingProvider> aiColumnMappingProvider;

    public static class ParsedPdf {
        public List<String> headers = new ArrayList<>();
        public List<List<String>> rows = new ArrayList<>();
        public boolean parsedByAi = false;
        public List<Map<String, Object>> directAiItems = new ArrayList<>();
    }

    public PdfInventoryParser(@Autowired(required = false) Optional<AiColumnMappingProvider> aiColumnMappingProvider) {
        this.aiColumnMappingProvider = aiColumnMappingProvider != null ? aiColumnMappingProvider : Optional.empty();
    }

    public ParsedPdf parse(byte[] pdfBytes, String fileName) {
        ParsedPdf result = new ParsedPdf();

        // 1. Try local PDFBox text stripping and table structure detection
        try (PDDocument document = PDDocument.load(new ByteArrayInputStream(pdfBytes))) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            String text = stripper.getText(document);

            if (text != null && !text.isBlank()) {
                boolean parsedLocally = attemptLocalTableExtraction(text, result);
                if (parsedLocally && !result.rows.isEmpty()) {
                    log.info("Successfully extracted {} rows from PDF via PDFBox layout parser", result.rows.size());
                    return result;
                }
            }
        } catch (Exception e) {
            log.warn("Local PDFBox extraction encountered error: {}", e.getMessage());
        }

        // 2. Fallback to AI Multimodal / LLM Extraction for complex/scanned tables
        if (aiColumnMappingProvider.isPresent()) {
            try {
                log.info("Delegating complex PDF parsing to AI provider for {}", fileName);
                List<Map<String, Object>> aiItems = aiColumnMappingProvider.get()
                        .extractInventoryFromPdf(pdfBytes, fileName);

                if (aiItems != null && !aiItems.isEmpty()) {
                    result.parsedByAi = true;
                    result.directAiItems = aiItems;
                    log.info("AI extracted {} items from PDF {}", aiItems.size(), fileName);
                    return result;
                }
            } catch (Exception e) {
                log.warn("AI PDF extraction failed: {}", e.getMessage());
            }
        }

        return result;
    }

    private boolean attemptLocalTableExtraction(String fullText, ParsedPdf result) {
        String[] rawLines = fullText.split("\\r?\\n");
        List<String> lines = new ArrayList<>();
        for (String line : rawLines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                lines.add(trimmed);
            }
        }

        if (lines.size() < 2) return false;

        // Try to identify delimiters in lines (e.g. multiple spaces, tabs, pipes)
        Pattern multiSpace = Pattern.compile("\\s{2,}|\t|\\|");

        int headerIndex = -1;
        List<String> headerCols = new ArrayList<>();

        for (int i = 0; i < Math.min(lines.size(), 15); i++) {
            String line = lines.get(i);
            String[] parts = multiSpace.split(line);
            if (parts.length >= 2) {
                // Check if tokens look like inventory headers
                String lower = line.toLowerCase();
                if (lower.contains("medicine") || lower.contains("item") || lower.contains("product")
                        || lower.contains("qty") || lower.contains("quantity") || lower.contains("price")
                        || lower.contains("mrp") || lower.contains("rate") || lower.contains("stock")) {
                    headerIndex = i;
                    for (String p : parts) {
                        if (!p.trim().isEmpty()) {
                            headerCols.add(p.trim());
                        }
                    }
                    break;
                }
            }
        }

        if (headerIndex == -1 || headerCols.isEmpty()) {
            return false;
        }

        result.headers = headerCols;
        int expectedCols = headerCols.size();

        for (int i = headerIndex + 1; i < lines.size(); i++) {
            String line = lines.get(i);
            String[] parts = multiSpace.split(line);
            List<String> cleanParts = new ArrayList<>();
            for (String p : parts) {
                if (!p.trim().isEmpty()) {
                    cleanParts.add(p.trim());
                }
            }

            if (!cleanParts.isEmpty()) {
                // If column count matches or is close
                while (cleanParts.size() < expectedCols) {
                    cleanParts.add("");
                }
                result.rows.add(cleanParts.subList(0, Math.min(cleanParts.size(), expectedCols)));
            }
        }

        return !result.rows.isEmpty();
    }
}
