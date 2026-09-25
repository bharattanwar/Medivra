package com.app.record.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "lab_report_parameters")
public class LabReportParameter extends BaseEntity {

    @Column(name = "report_id")
    private UUID reportId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "test_category")
    private String testCategory;

    @Column(name = "parameter_name", nullable = false)
    private String parameterName;

    @Column(name = "numeric_value")
    private Double numericValue;

    @Column(name = "raw_value", nullable = false)
    private String rawValue;

    @Column(name = "unit")
    private String unit;

    @Column(name = "reference_range_min")
    private Double referenceRangeMin;

    @Column(name = "reference_range_max")
    private Double referenceRangeMax;

    @Column(name = "reference_range_text")
    private String referenceRangeText;

    @Column(nullable = false)
    private String flag = "NORMAL"; // NORMAL, HIGH, LOW, CRITICAL_HIGH, CRITICAL_LOW

    @Column(name = "test_date", nullable = false)
    private LocalDate testDate;

    public UUID getReportId() {
        return reportId;
    }

    public void setReportId(UUID reportId) {
        this.reportId = reportId;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public String getTestCategory() {
        return testCategory;
    }

    public void setTestCategory(String testCategory) {
        this.testCategory = testCategory;
    }

    public String getParameterName() {
        return parameterName;
    }

    public void setParameterName(String parameterName) {
        this.parameterName = parameterName;
    }

    public Double getNumericValue() {
        return numericValue;
    }

    public void setNumericValue(Double numericValue) {
        this.numericValue = numericValue;
    }

    public String getRawValue() {
        return rawValue;
    }

    public void setRawValue(String rawValue) {
        this.rawValue = rawValue;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public Double getReferenceRangeMin() {
        return referenceRangeMin;
    }

    public void setReferenceRangeMin(Double referenceRangeMin) {
        this.referenceRangeMin = referenceRangeMin;
    }

    public Double getReferenceRangeMax() {
        return referenceRangeMax;
    }

    public void setReferenceRangeMax(Double referenceRangeMax) {
        this.referenceRangeMax = referenceRangeMax;
    }

    public String getReferenceRangeText() {
        return referenceRangeText;
    }

    public void setReferenceRangeText(String referenceRangeText) {
        this.referenceRangeText = referenceRangeText;
    }

    public String getFlag() {
        return flag;
    }

    public void setFlag(String flag) {
        this.flag = flag;
    }

    public LocalDate getTestDate() {
        return testDate;
    }

    public void setTestDate(LocalDate testDate) {
        this.testDate = testDate;
    }
}
