package com.app.pharmacy.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public class InventoryImportResponse {

    private UUID jobId;
    private String fileName;
    private String fileType;
    private String status;
    private int totalRows;
    private int validRows;
    private int errorRows;
    private int warningRows;
    private Map<String, String> detectedMappings;
    private List<String> rawHeaders;
    private List<InventoryImportRowDto> rows;
    private String errorMessage;

    public InventoryImportResponse() {}

    public UUID getJobId() {
        return jobId;
    }

    public void setJobId(UUID jobId) {
        this.jobId = jobId;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getFileType() {
        return fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getTotalRows() {
        return totalRows;
    }

    public void setTotalRows(int totalRows) {
        this.totalRows = totalRows;
    }

    public int getValidRows() {
        return validRows;
    }

    public void setValidRows(int validRows) {
        this.validRows = validRows;
    }

    public int getErrorRows() {
        return errorRows;
    }

    public void setErrorRows(int errorRows) {
        this.errorRows = errorRows;
    }

    public int getWarningRows() {
        return warningRows;
    }

    public void setWarningRows(int warningRows) {
        this.warningRows = warningRows;
    }

    public Map<String, String> getDetectedMappings() {
        return detectedMappings;
    }

    public void setDetectedMappings(Map<String, String> detectedMappings) {
        this.detectedMappings = detectedMappings;
    }

    public List<String> getRawHeaders() {
        return rawHeaders;
    }

    public void setRawHeaders(List<String> rawHeaders) {
        this.rawHeaders = rawHeaders;
    }

    public List<InventoryImportRowDto> getRows() {
        return rows;
    }

    public void setRows(List<InventoryImportRowDto> rows) {
        this.rows = rows;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }
}
