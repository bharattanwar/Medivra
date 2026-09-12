package com.app.pharmacy.service;

import com.app.pharmacy.dto.InventoryImportConfirmRequest;
import com.app.pharmacy.dto.InventoryImportResponse;
import com.app.pharmacy.dto.InventoryImportRowDto;
import com.app.pharmacy.entity.InventoryImportJob;
import com.app.pharmacy.entity.Medicine;
import com.app.pharmacy.entity.Pharmacy;
import com.app.pharmacy.entity.PharmacyInventory;
import com.app.pharmacy.repository.InventoryImportJobRepository;
import com.app.pharmacy.repository.MedicineRepository;
import com.app.pharmacy.repository.PharmacyInventoryRepository;
import com.app.pharmacy.repository.PharmacyRepository;
import com.app.pharmacy.service.importer.ColumnMappingService;
import com.app.pharmacy.service.importer.CsvInventoryParser;
import com.app.pharmacy.service.importer.ExcelInventoryParser;
import com.app.pharmacy.service.importer.PdfInventoryParser;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class InventoryImportService {

    private static final Logger log = LoggerFactory.getLogger(InventoryImportService.class);

    private final InventoryImportJobRepository jobRepository;
    private final PharmacyRepository pharmacyRepository;
    private final MedicineRepository medicineRepository;
    private final PharmacyInventoryRepository inventoryRepository;
    private final UserRepository userRepository;
    private final ColumnMappingService columnMappingService;
    private final ExcelInventoryParser excelParser;
    private final CsvInventoryParser csvParser;
    private final PdfInventoryParser pdfParser;
    private final ObjectMapper objectMapper;

    public InventoryImportService(InventoryImportJobRepository jobRepository,
                                  PharmacyRepository pharmacyRepository,
                                  MedicineRepository medicineRepository,
                                  PharmacyInventoryRepository inventoryRepository,
                                  UserRepository userRepository,
                                  ColumnMappingService columnMappingService,
                                  ExcelInventoryParser excelParser,
                                  CsvInventoryParser csvParser,
                                  PdfInventoryParser pdfParser) {
        this.jobRepository = jobRepository;
        this.pharmacyRepository = pharmacyRepository;
        this.medicineRepository = medicineRepository;
        this.inventoryRepository = inventoryRepository;
        this.userRepository = userRepository;
        this.columnMappingService = columnMappingService;
        this.excelParser = excelParser;
        this.csvParser = csvParser;
        this.pdfParser = pdfParser;
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Parses an uploaded file (Excel, CSV, PDF), extracts tabular data,
     * maps columns using AI & heuristic rules, validates rows, and persists an import job.
     */
    @Transactional
    public InventoryImportResponse processUpload(String userEmail, MultipartFile file) {
        Pharmacy pharmacy = resolvePharmacyByEmail(userEmail);
        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "inventory_upload";
        String fileExt = getFileExtension(originalFilename).toLowerCase();

        log.info("Processing inventory import for pharmacy '{}' from file '{}' ({})",
                pharmacy.getName(), originalFilename, fileExt);

        List<String> rawHeaders = new ArrayList<>();
        List<List<String>> rawRows = new ArrayList<>();
        List<InventoryImportRowDto> parsedRowDtos = new ArrayList<>();
        Map<String, String> detectedMappings = new HashMap<>();

        try {
            byte[] fileBytes = file.getBytes();

            if (fileExt.equals("xlsx") || fileExt.equals("xls")) {
                try (InputStream is = file.getInputStream()) {
                    ExcelInventoryParser.ParsedSheet sheet = excelParser.parse(is);
                    rawHeaders = sheet.headers;
                    rawRows = sheet.rows;
                }
            } else if (fileExt.equals("csv")) {
                CsvInventoryParser.ParsedCsv csv = csvParser.parse(fileBytes);
                rawHeaders = csv.headers;
                rawRows = csv.rows;
            } else if (fileExt.equals("pdf")) {
                PdfInventoryParser.ParsedPdf pdf = pdfParser.parse(fileBytes, originalFilename);
                if (pdf.parsedByAi && !pdf.directAiItems.isEmpty()) {
                    // Direct AI extracted items
                    parsedRowDtos = buildRowsFromDirectAi(pdf.directAiItems);
                    detectedMappings.put(ColumnMappingService.FIELD_MEDICINE_NAME, "AI Extracted: medicineName");
                    detectedMappings.put(ColumnMappingService.FIELD_QUANTITY, "AI Extracted: quantity");
                    detectedMappings.put(ColumnMappingService.FIELD_PRICE, "AI Extracted: price");
                } else {
                    rawHeaders = pdf.headers;
                    rawRows = pdf.rows;
                }
            } else {
                throw new IllegalArgumentException("Unsupported file type: " + fileExt + ". Please upload Excel (.xlsx, .xls), CSV (.csv), or PDF (.pdf).");
            }

            // If parsed via standard tabular columns
            if (parsedRowDtos.isEmpty()) {
                if (rawHeaders.isEmpty() || rawRows.isEmpty()) {
                    throw new RuntimeException("No valid data rows found in the uploaded file.");
                }

                // AI + Synonym Column Mapping
                List<List<String>> sampleRows = rawRows.subList(0, Math.min(rawRows.size(), 10));
                detectedMappings = columnMappingService.mapColumns(rawHeaders, sampleRows);

                log.info("Detected column mappings for {}: {}", originalFilename, detectedMappings);

                // Build & validate rows
                parsedRowDtos = buildAndValidateRows(rawHeaders, rawRows, detectedMappings);
            }

            // Metrics
            int validCount = (int) parsedRowDtos.stream().filter(r -> "VALID".equalsIgnoreCase(r.getStatus())).count();
            int warningCount = (int) parsedRowDtos.stream().filter(r -> "WARNING".equalsIgnoreCase(r.getStatus())).count();
            int errorCount = (int) parsedRowDtos.stream().filter(r -> "ERROR".equalsIgnoreCase(r.getStatus())).count();

            // Persist Job
            InventoryImportJob job = new InventoryImportJob();
            job.setPharmacyId(pharmacy.getId());
            job.setFileName(originalFilename);
            job.setFileType(fileExt);
            job.setStatus(errorCount == parsedRowDtos.size() ? "FAILED" : "READY_FOR_REVIEW");
            job.setTotalRows(parsedRowDtos.size());
            job.setValidRows(validCount + warningCount);
            job.setErrorRows(errorCount);
            job.setDetectedMappings(objectMapper.writeValueAsString(detectedMappings));
            job.setParsedData(objectMapper.writeValueAsString(parsedRowDtos));
            job = jobRepository.save(job);

            InventoryImportResponse response = new InventoryImportResponse();
            response.setJobId(job.getId());
            response.setFileName(originalFilename);
            response.setFileType(fileExt);
            response.setStatus(job.getStatus());
            response.setTotalRows(parsedRowDtos.size());
            response.setValidRows(validCount);
            response.setWarningRows(warningCount);
            response.setErrorRows(errorCount);
            response.setDetectedMappings(detectedMappings);
            response.setRawHeaders(rawHeaders);
            response.setRows(parsedRowDtos);

            return response;

        } catch (Exception e) {
            log.error("Failed to process inventory file '{}': {}", originalFilename, e.getMessage(), e);
            throw new RuntimeException("Error processing file: " + e.getMessage(), e);
        }
    }

    /**
     * Confirms and persists the selected/edited inventory items into the database.
     */
    @Transactional
    public Map<String, Object> confirmImport(String userEmail, UUID jobId, InventoryImportConfirmRequest request) {
        Pharmacy pharmacy = resolvePharmacyByEmail(userEmail);
        InventoryImportJob job = jobRepository.findById(jobId)
                .orElseThrow(() -> new RuntimeException("Import job not found: " + jobId));

        if (!job.getPharmacyId().equals(pharmacy.getId())) {
            throw new RuntimeException("Unauthorized to modify this import job");
        }

        List<InventoryImportRowDto> rowsToImport = request.getRows() != null ? request.getRows() : Collections.emptyList();
        int importedCount = 0;
        int updatedCount = 0;
        int skippedCount = 0;

        for (InventoryImportRowDto row : rowsToImport) {
            if (!row.isSelected() || "ERROR".equalsIgnoreCase(row.getStatus())) {
                skippedCount++;
                continue;
            }

            if (row.getMedicineName() == null || row.getMedicineName().isBlank()) {
                skippedCount++;
                continue;
            }

            Integer quantity = row.getQuantity() != null && row.getQuantity() > 0 ? row.getQuantity() : 1;
            BigDecimal price = row.getPrice() != null && row.getPrice().compareTo(BigDecimal.ZERO) > 0
                    ? row.getPrice()
                    : BigDecimal.valueOf(100.00);

            // Resolve or create medicine
            Medicine medicine = resolveOrCreateMedicine(row.getMedicineName(), row.getStrength(), row.getManufacturer());

            // Upsert into PharmacyInventory
            Optional<PharmacyInventory> existingInv = inventoryRepository
                    .findByPharmacyIdAndMedicineId(pharmacy.getId(), medicine.getId());

            if (existingInv.isPresent()) {
                PharmacyInventory inv = existingInv.get();
                if (request.isUpdateExisting()) {
                    inv.setQuantity(inv.getQuantity() + quantity);
                } else {
                    inv.setQuantity(quantity);
                }
                inv.setPrice(price);
                inventoryRepository.save(inv);
                updatedCount++;
            } else {
                PharmacyInventory inv = new PharmacyInventory();
                inv.setPharmacy(pharmacy);
                inv.setMedicine(medicine);
                inv.setQuantity(quantity);
                inv.setPrice(price);
                inventoryRepository.save(inv);
                importedCount++;
            }
        }

        job.setStatus("COMPLETED");
        jobRepository.save(job);

        Map<String, Object> result = new HashMap<>();
        result.put("jobId", jobId);
        result.put("status", "COMPLETED");
        result.put("newlyAdded", importedCount);
        result.put("updatedExisting", updatedCount);
        result.put("skipped", skippedCount);
        result.put("message", String.format("Successfully processed inventory import: %d new medicines added, %d existing stock updated.",
                importedCount, updatedCount));

        return result;
    }

    /**
     * Retrieves an existing import job preview.
     */
    @Transactional(readOnly = true)
    public InventoryImportResponse getImportJob(String userEmail, UUID jobId) {
        Pharmacy pharmacy = resolvePharmacyByEmail(userEmail);
        InventoryImportJob job = jobRepository.findById(jobId)
                .orElseThrow(() -> new RuntimeException("Import job not found: " + jobId));

        if (!job.getPharmacyId().equals(pharmacy.getId())) {
            throw new RuntimeException("Unauthorized to access this import job");
        }

        try {
            Map<String, String> mappings = job.getDetectedMappings() != null
                    ? objectMapper.readValue(job.getDetectedMappings(), new TypeReference<Map<String, String>>() {})
                    : Collections.emptyMap();

            List<InventoryImportRowDto> rows = job.getParsedData() != null
                    ? objectMapper.readValue(job.getParsedData(), new TypeReference<List<InventoryImportRowDto>>() {})
                    : Collections.emptyList();

            InventoryImportResponse response = new InventoryImportResponse();
            response.setJobId(job.getId());
            response.setFileName(job.getFileName());
            response.setFileType(job.getFileType());
            response.setStatus(job.getStatus());
            response.setTotalRows(job.getTotalRows());
            response.setValidRows(job.getValidRows());
            response.setErrorRows(job.getErrorRows());
            response.setDetectedMappings(mappings);
            response.setRows(rows);
            response.setErrorMessage(job.getErrorMessage());

            return response;
        } catch (Exception e) {
            throw new RuntimeException("Failed to read job data: " + e.getMessage(), e);
        }
    }

    // ── Row Construction & Normalization Helpers ──────────────────────────────

    private List<InventoryImportRowDto> buildAndValidateRows(List<String> headers,
                                                              List<List<String>> rawRows,
                                                              Map<String, String> mappings) {
        List<InventoryImportRowDto> dtoList = new ArrayList<>();

        int nameCol = findHeaderIndex(headers, mappings.get(ColumnMappingService.FIELD_MEDICINE_NAME));
        int strengthCol = findHeaderIndex(headers, mappings.get(ColumnMappingService.FIELD_STRENGTH));
        int mfrCol = findHeaderIndex(headers, mappings.get(ColumnMappingService.FIELD_MANUFACTURER));
        int qtyCol = findHeaderIndex(headers, mappings.get(ColumnMappingService.FIELD_QUANTITY));
        int priceCol = findHeaderIndex(headers, mappings.get(ColumnMappingService.FIELD_PRICE));
        int expCol = findHeaderIndex(headers, mappings.get(ColumnMappingService.FIELD_EXPIRY_DATE));

        for (int i = 0; i < rawRows.size(); i++) {
            List<String> raw = rawRows.get(i);
            int rowNum = i + 1;

            String rawName = getCell(raw, nameCol);
            String rawStrength = getCell(raw, strengthCol);
            String rawMfr = getCell(raw, mfrCol);
            String rawQty = getCell(raw, qtyCol);
            String rawPrice = getCell(raw, priceCol);
            String rawExp = getCell(raw, expCol);

            // Clean medicine name
            String cleanName = cleanMedicineName(rawName);

            // Clean and extract strength from name if not provided in separate column
            if (rawStrength.isEmpty() && cleanName.matches(".*\\d+\\s*(mg|mcg|g|ml|iu|%|tablet|capsule).*")) {
                Pattern p = Pattern.compile("(\\d+(\\.\\d+)?\\s*(mg|mcg|g|ml|iu|%))", Pattern.CASE_INSENSITIVE);
                Matcher m = p.matcher(cleanName);
                if (m.find()) {
                    rawStrength = m.group(1);
                }
            }

            Integer quantity = parseQuantity(rawQty);
            BigDecimal price = parsePrice(rawPrice);

            // Validation Status
            String status = "VALID";
            StringBuilder errors = new StringBuilder();

            if (cleanName.isBlank()) {
                status = "ERROR";
                errors.append("Medicine name is missing. ");
            }

            if (quantity == null || quantity <= 0) {
                if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
                    status = "ERROR";
                    errors.append("Invalid quantity and price. ");
                } else {
                    status = "WARNING";
                    quantity = 1; // Default fallback
                    errors.append("Quantity was missing/invalid; defaulted to 1. ");
                }
            }

            if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
                if ("ERROR".equals(status)) {
                    errors.append("Price is missing or 0. ");
                } else {
                    status = "WARNING";
                    price = BigDecimal.valueOf(50.00); // Default fallback
                    errors.append("Price was missing; defaulted to 50.00. ");
                }
            }

            InventoryImportRowDto rowDto = new InventoryImportRowDto(
                    rowNum, cleanName, rawStrength, rawMfr, quantity, price, rawExp,
                    status, errors.toString().trim()
            );

            dtoList.add(rowDto);
        }

        return dtoList;
    }

    private List<InventoryImportRowDto> buildRowsFromDirectAi(List<Map<String, Object>> aiItems) {
        List<InventoryImportRowDto> rows = new ArrayList<>();
        int rowNum = 1;

        for (Map<String, Object> item : aiItems) {
            String name = cleanMedicineName(Objects.toString(item.get("medicineName"), ""));
            String strength = Objects.toString(item.get("strength"), "");
            String mfr = Objects.toString(item.get("manufacturer"), "");
            Integer qty = parseQuantity(Objects.toString(item.get("quantity"), "1"));
            BigDecimal price = parsePrice(Objects.toString(item.get("price"), "100"));
            String exp = Objects.toString(item.get("expiryDate"), "");

            String status = name.isBlank() ? "ERROR" : "VALID";
            String error = name.isBlank() ? "Medicine name is missing" : "";

            rows.add(new InventoryImportRowDto(rowNum++, name, strength, mfr, qty, price, exp, status, error));
        }

        return rows;
    }

    private int findHeaderIndex(List<String> headers, String targetHeader) {
        if (targetHeader == null || headers == null) return -1;
        for (int i = 0; i < headers.size(); i++) {
            if (headers.get(i).equalsIgnoreCase(targetHeader)) {
                return i;
            }
        }
        return -1;
    }

    private String getCell(List<String> row, int index) {
        if (index >= 0 && index < row.size() && row.get(index) != null) {
            return row.get(index).trim();
        }
        return "";
    }

    private String cleanMedicineName(String raw) {
        if (raw == null) return "";
        return raw.replaceAll("^[0-9]+[.\\-\\s]+", "") // remove leading "1. " or "1 - "
                .replaceAll("[\"'\t\r\n]", "")
                .trim();
    }

    private Integer parseQuantity(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            // Remove text suffixes like "pcs", "boxes", "units", "strips"
            String cleaned = raw.replaceAll("[^0-9.]", "").trim();
            if (cleaned.isEmpty()) return null;
            if (cleaned.contains(".")) {
                return (int) Double.parseDouble(cleaned);
            }
            return Integer.parseInt(cleaned);
        } catch (Exception e) {
            return null;
        }
    }

    private BigDecimal parsePrice(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            // Strip currency symbols (₹, $, Rs, INR, etc.) and commas
            String cleaned = raw.replaceAll("[^0-9.]", "").trim();
            if (cleaned.isEmpty()) return null;
            return new BigDecimal(cleaned).setScale(2, RoundingMode.HALF_UP);
        } catch (Exception e) {
            return null;
        }
    }

    private String getFileExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(dot + 1) : "";
    }

    private Pharmacy resolvePharmacyByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found: " + email));
        return pharmacyRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Pharmacy profile not found for user: " + email));
    }

    private Medicine resolveOrCreateMedicine(String name, String strength, String manufacturer) {
        List<Medicine> existing = medicineRepository.findByNameContainingIgnoreCase(name.trim());
        Optional<Medicine> exactMatch = existing.stream()
                .filter(m -> m.getName().equalsIgnoreCase(name.trim()))
                .findFirst();

        if (exactMatch.isPresent()) {
            return exactMatch.get();
        }

        Medicine newMed = new Medicine();
        newMed.setName(name.trim());
        newMed.setStrength(strength != null && !strength.isBlank() ? strength.trim() : null);
        newMed.setManufacturer(manufacturer != null && !manufacturer.isBlank() ? manufacturer.trim() : null);
        return medicineRepository.save(newMed);
    }
}
