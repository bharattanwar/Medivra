package com.app.pharmacy.service.importer;

import org.apache.poi.ss.usermodel.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

@Component
public class ExcelInventoryParser {

    private static final Logger log = LoggerFactory.getLogger(ExcelInventoryParser.class);

    public static class ParsedSheet {
        public List<String> headers = new ArrayList<>();
        public List<List<String>> rows = new ArrayList<>();
    }

    public ParsedSheet parse(InputStream inputStream) throws Exception {
        ParsedSheet result = new ParsedSheet();
        DataFormatter formatter = new DataFormatter();

        try (Workbook workbook = WorkbookFactory.create(inputStream)) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                return result;
            }

            int firstRowNum = sheet.getFirstRowNum();
            int lastRowNum = sheet.getLastRowNum();

            // 1. Find the header row: first row with multiple non-empty text cells
            int headerRowIndex = -1;
            List<String> detectedHeaders = new ArrayList<>();

            for (int r = firstRowNum; r <= Math.min(lastRowNum, 10); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                List<String> candidateHeaders = new ArrayList<>();
                int nonEmptyCount = 0;
                short lastCellNum = row.getLastCellNum();

                for (int c = 0; c < lastCellNum; c++) {
                    Cell cell = row.getCell(c, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                    String val = cell != null ? formatter.formatCellValue(cell).trim() : "";
                    if (!val.isEmpty()) {
                        nonEmptyCount++;
                    }
                    candidateHeaders.add(val);
                }

                if (nonEmptyCount >= 2) {
                    headerRowIndex = r;
                    detectedHeaders = candidateHeaders;
                    break;
                }
            }

            if (headerRowIndex == -1 || detectedHeaders.isEmpty()) {
                log.warn("No header row detected in Excel sheet");
                return result;
            }

            // Clean headers (remove trailing empty headers)
            int lastNonEmptyHeaderIdx = detectedHeaders.size() - 1;
            while (lastNonEmptyHeaderIdx >= 0 && detectedHeaders.get(lastNonEmptyHeaderIdx).isEmpty()) {
                lastNonEmptyHeaderIdx--;
            }

            List<String> finalHeaders = new ArrayList<>();
            for (int i = 0; i <= lastNonEmptyHeaderIdx; i++) {
                String h = detectedHeaders.get(i);
                finalHeaders.add(h.isEmpty() ? "Column_" + (i + 1) : h);
            }
            result.headers = finalHeaders;

            // 2. Read data rows
            int headerCols = finalHeaders.size();
            for (int r = headerRowIndex + 1; r <= lastRowNum; r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                List<String> rowValues = new ArrayList<>();
                boolean hasContent = false;

                for (int c = 0; c < headerCols; c++) {
                    Cell cell = row.getCell(c, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                    String val = cell != null ? formatter.formatCellValue(cell).trim() : "";
                    if (!val.isEmpty()) {
                        hasContent = true;
                    }
                    rowValues.add(val);
                }

                if (hasContent) {
                    result.rows.add(rowValues);
                }
            }
        }

        log.info("Parsed Excel sheet: {} headers, {} rows", result.headers.size(), result.rows.size());
        return result;
    }
}
