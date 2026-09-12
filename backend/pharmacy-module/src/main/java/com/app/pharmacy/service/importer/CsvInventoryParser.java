package com.app.pharmacy.service.importer;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Component
public class CsvInventoryParser {

    private static final Logger log = LoggerFactory.getLogger(CsvInventoryParser.class);

    public static class ParsedCsv {
        public List<String> headers = new ArrayList<>();
        public List<List<String>> rows = new ArrayList<>();
    }

    public ParsedCsv parse(byte[] bytes) throws Exception {
        ParsedCsv result = new ParsedCsv();
        char delimiter = detectDelimiter(bytes);

        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setDelimiter(delimiter)
                .setIgnoreSurroundingSpaces(true)
                .setTrim(true)
                .build();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new ByteArrayInputStream(bytes), StandardCharsets.UTF_8));
             CSVParser parser = new CSVParser(reader, format)) {

            List<CSVRecord> records = parser.getRecords();
            if (records.isEmpty()) {
                return result;
            }

            // Find header record
            int headerIdx = 0;
            CSVRecord headerRecord = records.get(headerIdx);
            for (int i = 0; i < headerRecord.size(); i++) {
                String h = headerRecord.get(i).trim();
                // Remove UTF-8 BOM if present
                if (i == 0 && h.startsWith("\uFEFF")) {
                    h = h.substring(1).trim();
                }
                result.headers.add(h.isEmpty() ? "Column_" + (i + 1) : h);
            }

            int colCount = result.headers.size();
            for (int i = 1; i < records.size(); i++) {
                CSVRecord rec = records.get(i);
                List<String> row = new ArrayList<>();
                boolean hasContent = false;

                for (int c = 0; c < colCount; c++) {
                    String val = c < rec.size() ? rec.get(c).trim() : "";
                    if (!val.isEmpty()) {
                        hasContent = true;
                    }
                    row.add(val);
                }

                if (hasContent) {
                    result.rows.add(row);
                }
            }
        }

        log.info("Parsed CSV: delimiter '{}', {} headers, {} rows", delimiter, result.headers.size(), result.rows.size());
        return result;
    }

    private char detectDelimiter(byte[] bytes) {
        String sample = new String(bytes, 0, Math.min(bytes.length, 2048), StandardCharsets.UTF_8);
        int commas = countOccurrences(sample, ',');
        int semicolons = countOccurrences(sample, ';');
        int tabs = countOccurrences(sample, '\t');
        int pipes = countOccurrences(sample, '|');

        if (semicolons > commas && semicolons > tabs && semicolons > pipes) return ';';
        if (tabs > commas && tabs > semicolons && tabs > pipes) return '\t';
        if (pipes > commas && pipes > semicolons && pipes > tabs) return '|';
        return ',';
    }

    private int countOccurrences(String text, char target) {
        int count = 0;
        for (char c : text.toCharArray()) {
            if (c == target) count++;
        }
        return count;
    }
}
