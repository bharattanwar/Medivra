package com.app.pharmacy.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "inventory_import_jobs")
public class InventoryImportJob extends BaseEntity {

    @Column(name = "pharmacy_id", nullable = false)
    private UUID pharmacyId;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "file_type", nullable = false)
    private String fileType;

    @Column(nullable = false)
    private String status; // PENDING, PARSING, READY_FOR_REVIEW, IMPORTING, COMPLETED, FAILED

    @Column(name = "total_rows", nullable = false)
    private int totalRows;

    @Column(name = "valid_rows", nullable = false)
    private int validRows;

    @Column(name = "error_rows", nullable = false)
    private int errorRows;

    @Column(name = "detected_mappings", columnDefinition = "TEXT")
    private String detectedMappings; // JSON string

    @Column(name = "parsed_data", columnDefinition = "TEXT")
    private String parsedData; // JSON string of parsed rows

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    public UUID getPharmacyId() {
        return pharmacyId;
    }

    public void setPharmacyId(UUID pharmacyId) {
        this.pharmacyId = pharmacyId;
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

    public String getDetectedMappings() {
        return detectedMappings;
    }

    public void setDetectedMappings(String detectedMappings) {
        this.detectedMappings = detectedMappings;
    }

    public String getParsedData() {
        return parsedData;
    }

    public void setParsedData(String parsedData) {
        this.parsedData = parsedData;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }
}
