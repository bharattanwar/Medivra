package com.app.record.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class IngestLabParametersRequest {
    private UUID reportId;
    private UUID patientId;
    private String testCategory;
    private LocalDate testDate;
    private Boolean isHealthJourneyFulfillment;
    private UUID linkedLabTestId;
    private UUID linkedTaskId;
    private List<LabParameterInput> parameters;

    public IngestLabParametersRequest() {}

    public UUID getReportId() { return reportId; }
    public void setReportId(UUID reportId) { this.reportId = reportId; }

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public String getTestCategory() { return testCategory; }
    public void setTestCategory(String testCategory) { this.testCategory = testCategory; }

    public LocalDate getTestDate() { return testDate; }
    public void setTestDate(LocalDate testDate) { this.testDate = testDate; }

    public Boolean getIsHealthJourneyFulfillment() { return isHealthJourneyFulfillment; }
    public void setIsHealthJourneyFulfillment(Boolean isHealthJourneyFulfillment) { this.isHealthJourneyFulfillment = isHealthJourneyFulfillment; }

    public UUID getLinkedLabTestId() { return linkedLabTestId; }
    public void setLinkedLabTestId(UUID linkedLabTestId) { this.linkedLabTestId = linkedLabTestId; }

    public UUID getLinkedTaskId() { return linkedTaskId; }
    public void setLinkedTaskId(UUID linkedTaskId) { this.linkedTaskId = linkedTaskId; }

    public List<LabParameterInput> getParameters() { return parameters; }
    public void setParameters(List<LabParameterInput> parameters) { this.parameters = parameters; }

    public static class LabParameterInput {
        private String parameterName;
        private Double numericValue;
        private String rawValue;
        private String unit;
        private Double referenceRangeMin;
        private Double referenceRangeMax;
        private String referenceRangeText;
        private String flag;

        public LabParameterInput() {}

        public String getParameterName() { return parameterName; }
        public void setParameterName(String parameterName) { this.parameterName = parameterName; }

        public Double getNumericValue() { return numericValue; }
        public void setNumericValue(Double numericValue) { this.numericValue = numericValue; }

        public String getRawValue() { return rawValue; }
        public void setRawValue(String rawValue) { this.rawValue = rawValue; }

        public String getUnit() { return unit; }
        public void setUnit(String unit) { this.unit = unit; }

        public Double getReferenceRangeMin() { return referenceRangeMin; }
        public void setReferenceRangeMin(Double referenceRangeMin) { this.referenceRangeMin = referenceRangeMin; }

        public Double getReferenceRangeMax() { return referenceRangeMax; }
        public void setReferenceRangeMax(Double referenceRangeMax) { this.referenceRangeMax = referenceRangeMax; }

        public String getReferenceRangeText() { return referenceRangeText; }
        public void setReferenceRangeText(String referenceRangeText) { this.referenceRangeText = referenceRangeText; }

        public String getFlag() { return flag; }
        public void setFlag(String flag) { this.flag = flag; }
    }
}
