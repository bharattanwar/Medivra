package com.app.pharmacy.service.importer;

import java.util.List;
import java.util.Map;

/**
 * Interface allowing AI modules (e.g. Gemini) to provide intelligent
 * column mapping and PDF extraction capabilities.
 */
public interface AiColumnMappingProvider {

    /**
     * Inactive or fallback returns empty map.
     * When implemented by AI module, calls Gemini LLM with structured schema.
     */
    Map<String, String> inferColumnMappings(List<String> headers, List<List<String>> sampleRows);

    /**
     * Extracts inventory items directly from unstructured PDF documents.
     */
    List<Map<String, Object>> extractInventoryFromPdf(byte[] pdfBytes, String fileName);
}
