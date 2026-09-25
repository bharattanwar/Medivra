package com.app.record.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class LabTrendResponse {
    private UUID reportId;
    private String parameterName;
    private String testCategory;
    private String unit;
    private Double referenceRangeMin;
    private Double referenceRangeMax;
    private String referenceRangeText;
    
    // Latest reading
    private Double latestValue;
    private String latestRawValue;
    private String latestFlag; // NORMAL, HIGH, LOW
    private LocalDate latestDate;
    
    // Previous reading
    private Double previousValue;
    private String previousRawValue;
    private String previousFlag;
    private LocalDate previousDate;
    
    // Deterministic Delta Computation (in Java)
    private Double deltaNumeric;
    private Double deltaPercentage;
    private String trendDirection; // IMPROVING, WORSENING, STABLE, INCREASED, DECREASED
    private String statusTransition; // e.g. "HIGH -> NORMAL"
    
    // Historical sequence
    private List<LabParameterReadingDto> history;

    public LabTrendResponse() {}

    public UUID getReportId() { return reportId; }
    public void setReportId(UUID reportId) { this.reportId = reportId; }

    public String getParameterName() { return parameterName; }
    public void setParameterName(String parameterName) { this.parameterName = parameterName; }

    public String getTestCategory() { return testCategory; }
    public void setTestCategory(String testCategory) { this.testCategory = testCategory; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public Double getReferenceRangeMin() { return referenceRangeMin; }
    public void setReferenceRangeMin(Double referenceRangeMin) { this.referenceRangeMin = referenceRangeMin; }

    public Double getReferenceRangeMax() { return referenceRangeMax; }
    public void setReferenceRangeMax(Double referenceRangeMax) { this.referenceRangeMax = referenceRangeMax; }

    public String getReferenceRangeText() { return referenceRangeText; }
    public void setReferenceRangeText(String referenceRangeText) { this.referenceRangeText = referenceRangeText; }

    public Double getLatestValue() { return latestValue; }
    public void setLatestValue(Double latestValue) { this.latestValue = latestValue; }

    public String getLatestRawValue() { return latestRawValue; }
    public void setLatestRawValue(String latestRawValue) { this.latestRawValue = latestRawValue; }

    public String getLatestFlag() { return latestFlag; }
    public void setLatestFlag(String latestFlag) { this.latestFlag = latestFlag; }

    public LocalDate getLatestDate() { return latestDate; }
    public void setLatestDate(LocalDate latestDate) { this.latestDate = latestDate; }

    public Double getPreviousValue() { return previousValue; }
    public void setPreviousValue(Double previousValue) { this.previousValue = previousValue; }

    public String getPreviousRawValue() { return previousRawValue; }
    public void setPreviousRawValue(String previousRawValue) { this.previousRawValue = previousRawValue; }

    public String getPreviousFlag() { return previousFlag; }
    public void setPreviousFlag(String previousFlag) { this.previousFlag = previousFlag; }

    public LocalDate getPreviousDate() { return previousDate; }
    public void setPreviousDate(LocalDate previousDate) { this.previousDate = previousDate; }

    public Double getDeltaNumeric() { return deltaNumeric; }
    public void setDeltaNumeric(Double deltaNumeric) { this.deltaNumeric = deltaNumeric; }

    public Double getDeltaPercentage() { return deltaPercentage; }
    public void setDeltaPercentage(Double deltaPercentage) { this.deltaPercentage = deltaPercentage; }

    public String getTrendDirection() { return trendDirection; }
    public void setTrendDirection(String trendDirection) { this.trendDirection = trendDirection; }

    public String getStatusTransition() { return statusTransition; }
    public void setStatusTransition(String statusTransition) { this.statusTransition = statusTransition; }

    public List<LabParameterReadingDto> getHistory() { return history; }
    public void setHistory(List<LabParameterReadingDto> history) { this.history = history; }

    public static class LabParameterReadingDto {
        private UUID id;
        private UUID reportId;
        private Double numericValue;
        private String rawValue;
        private String flag;
        private LocalDate testDate;

        public LabParameterReadingDto() {}

        public LabParameterReadingDto(UUID id, UUID reportId, Double numericValue, String rawValue, String flag, LocalDate testDate) {
            this.id = id;
            this.reportId = reportId;
            this.numericValue = numericValue;
            this.rawValue = rawValue;
            this.flag = flag;
            this.testDate = testDate;
        }

        public UUID getId() { return id; }
        public void setId(UUID id) { this.id = id; }

        public UUID getReportId() { return reportId; }
        public void setReportId(UUID reportId) { this.reportId = reportId; }

        public Double getNumericValue() { return numericValue; }
        public void setNumericValue(Double numericValue) { this.numericValue = numericValue; }

        public String getRawValue() { return rawValue; }
        public void setRawValue(String rawValue) { this.rawValue = rawValue; }

        public String getFlag() { return flag; }
        public void setFlag(String flag) { this.flag = flag; }

        public LocalDate getTestDate() { return testDate; }
        public void setTestDate(LocalDate testDate) { this.testDate = testDate; }
    }
}
