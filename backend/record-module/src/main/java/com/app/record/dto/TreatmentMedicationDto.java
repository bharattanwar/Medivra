package com.app.record.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class TreatmentMedicationDto {
    private UUID id;
    private UUID treatmentPlanId;
    private UUID prescriptionItemId;
    private String medicineName;
    private String strength;
    private String dosage;
    private String frequency;
    private Integer totalDays;
    private LocalDate startDate;
    private LocalDate endDate;
    private String instructions;
    private String status;
    private Integer dayNumber;
    private List<MedicationDoseLogDto> todayDoses;

    public TreatmentMedicationDto() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTreatmentPlanId() { return treatmentPlanId; }
    public void setTreatmentPlanId(UUID treatmentPlanId) { this.treatmentPlanId = treatmentPlanId; }

    public UUID getPrescriptionItemId() { return prescriptionItemId; }
    public void setPrescriptionItemId(UUID prescriptionItemId) { this.prescriptionItemId = prescriptionItemId; }

    public String getMedicineName() { return medicineName; }
    public void setMedicineName(String medicineName) { this.medicineName = medicineName; }

    public String getStrength() { return strength; }
    public void setStrength(String strength) { this.strength = strength; }

    public String getDosage() { return dosage; }
    public void setDosage(String dosage) { this.dosage = dosage; }

    public String getFrequency() { return frequency; }
    public void setFrequency(String frequency) { this.frequency = frequency; }

    public Integer getTotalDays() { return totalDays; }
    public void setTotalDays(Integer totalDays) { this.totalDays = totalDays; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public String getInstructions() { return instructions; }
    public void setInstructions(String instructions) { this.instructions = instructions; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getDayNumber() { return dayNumber; }
    public void setDayNumber(Integer dayNumber) { this.dayNumber = dayNumber; }

    public List<MedicationDoseLogDto> getTodayDoses() { return todayDoses; }
    public void setTodayDoses(List<MedicationDoseLogDto> todayDoses) { this.todayDoses = todayDoses; }
}
