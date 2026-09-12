package com.app.pharmacy.service.importer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Maps arbitrary vendor/pharmacy column headers to standardized Medivra inventory fields:
 * - medicineName
 * - strength
 * - manufacturer
 * - quantity
 * - price
 * - expiryDate
 */
@Service
public class ColumnMappingService {

    private static final Logger log = LoggerFactory.getLogger(ColumnMappingService.class);

    public static final String FIELD_MEDICINE_NAME = "medicineName";
    public static final String FIELD_STRENGTH = "strength";
    public static final String FIELD_MANUFACTURER = "manufacturer";
    public static final String FIELD_QUANTITY = "quantity";
    public static final String FIELD_PRICE = "price";
    public static final String FIELD_EXPIRY_DATE = "expiryDate";

    private final Optional<AiColumnMappingProvider> aiColumnMappingProvider;

    private static final Map<String, List<String>> SYNONYMS = new HashMap<>();

    static {
        SYNONYMS.put(FIELD_MEDICINE_NAME, List.of(
                "medicinename", "medicine", "medname", "drug", "drugname", "item", "itemname",
                "itemdescription", "description", "product", "productname", "particulars",
                "itemdesc", "brand", "brandname", "productdescription", "sku", "article"
        ));

        SYNONYMS.put(FIELD_STRENGTH, List.of(
                "strength", "dosage", "dose", "power", "potency", "mg", "concentration",
                "composition", "formulation", "spec", "specification"
        ));

        SYNONYMS.put(FIELD_MANUFACTURER, List.of(
                "manufacturer", "mfr", "mfg", "company", "pharma", "brand", "producer",
                "supplier", "distributor", "make", "lab", "laboratory"
        ));

        SYNONYMS.put(FIELD_QUANTITY, List.of(
                "quantity", "qty", "stock", "stockquantity", "availablestock", "available",
                "units", "unitsavailable", "count", "balance", "bal", "onhand", "qnty",
                "avail", "currentstock", "inventory", "inventoryqty", "nos", "pcs", "boxes"
        ));

        SYNONYMS.put(FIELD_PRICE, List.of(
                "price", "mrp", "salerate", "rate", "sellingprice", "unitprice", "cost",
                "amount", "saleprice", "retailsale", "retailprice", "val", "itemrate", "netrate"
        ));

        SYNONYMS.put(FIELD_EXPIRY_DATE, List.of(
                "expiry", "expirydate", "exp", "expdate", "expirydt", "validtill",
                "usebefore", "validthru", "expiration", "expirationdate", "bestbefore"
        ));
    }

    public ColumnMappingService(@Autowired(required = false) Optional<AiColumnMappingProvider> aiColumnMappingProvider) {
        this.aiColumnMappingProvider = aiColumnMappingProvider != null ? aiColumnMappingProvider : Optional.empty();
    }

    /**
     * Determines column mappings from headers and sample row values.
     * Returns a Map where key = standard field name, value = matching raw header name.
     */
    public Map<String, String> mapColumns(List<String> rawHeaders, List<List<String>> sampleRows) {
        Map<String, String> mapping = new HashMap<>();
        Set<String> usedHeaders = new HashSet<>();

        // 1. Pass 1: Rule-based exact / normalized synonym match
        for (Map.Entry<String, List<String>> entry : SYNONYMS.entrySet()) {
            String standardField = entry.getKey();
            List<String> synonyms = entry.getValue();

            for (String rawHeader : rawHeaders) {
                if (usedHeaders.contains(rawHeader)) continue;
                String normalized = normalizeHeader(rawHeader);

                if (synonyms.contains(normalized)) {
                    mapping.put(standardField, rawHeader);
                    usedHeaders.add(rawHeader);
                    break;
                }
            }
        }

        // 2. Pass 2: Substring / fuzzy prefix match for unmapped standard fields
        for (Map.Entry<String, List<String>> entry : SYNONYMS.entrySet()) {
            String standardField = entry.getKey();
            if (mapping.containsKey(standardField)) continue;

            List<String> synonyms = entry.getValue();
            for (String rawHeader : rawHeaders) {
                if (usedHeaders.contains(rawHeader)) continue;
                String normalized = normalizeHeader(rawHeader);

                for (String syn : synonyms) {
                    if (normalized.contains(syn) || syn.contains(normalized)) {
                        mapping.put(standardField, rawHeader);
                        usedHeaders.add(rawHeader);
                        break;
                    }
                }
                if (mapping.containsKey(standardField)) break;
            }
        }

        // 3. Pass 3: If essential fields (medicineName, quantity, price) are missing, consult AI
        boolean needsAi = !mapping.containsKey(FIELD_MEDICINE_NAME)
                || !mapping.containsKey(FIELD_QUANTITY)
                || !mapping.containsKey(FIELD_PRICE);

        if (needsAi && aiColumnMappingProvider.isPresent()) {
            try {
                log.info("Invoking AI Column Mapping Provider for headers: {}", rawHeaders);
                Map<String, String> aiMappings = aiColumnMappingProvider.get()
                        .inferColumnMappings(rawHeaders, sampleRows);
                if (aiMappings != null && !aiMappings.isEmpty()) {
                    for (Map.Entry<String, String> aiEntry : aiMappings.entrySet()) {
                        String field = aiEntry.getKey();
                        String matchedHeader = aiEntry.getValue();
                        if (!mapping.containsKey(field) && rawHeaders.contains(matchedHeader)) {
                            mapping.put(field, matchedHeader);
                            usedHeaders.add(matchedHeader);
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("AI Column Mapping fallback failed, proceeding with heuristic mappings: {}", e.getMessage());
            }
        }

        return mapping;
    }

    private String normalizeHeader(String header) {
        if (header == null) return "";
        return header.toLowerCase()
                .replaceAll("[^a-z0-9]", "")
                .trim();
    }
}
