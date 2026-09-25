package com.app.record.dto;

import java.util.List;
import java.util.UUID;

public class NextActionResponse {
    private UUID patientId;
    private TreatmentPlanDto activePlan;
    private List<MedicationDoseLogDto> todayDoses;
    private List<CareTaskDto> todayTasks;
    private List<CareTaskDto> nextTasks;
    private List<TreatmentLabTestDto> pendingLabTests;
    private String nextFollowUpRecommendation;
    private String followUpDoctorName;
    private UUID followUpDoctorId;
    private Integer takenDosesToday;
    private Integer totalDosesToday;
    private Integer completedTasksTotal;
    private Integer pendingTasksTotal;

    public NextActionResponse() {}

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public TreatmentPlanDto getActivePlan() { return activePlan; }
    public void setActivePlan(TreatmentPlanDto activePlan) { this.activePlan = activePlan; }

    public List<MedicationDoseLogDto> getTodayDoses() { return todayDoses; }
    public void setTodayDoses(List<MedicationDoseLogDto> todayDoses) { this.todayDoses = todayDoses; }

    public List<CareTaskDto> getTodayTasks() { return todayTasks; }
    public void setTodayTasks(List<CareTaskDto> todayTasks) { this.todayTasks = todayTasks; }

    public List<CareTaskDto> getNextTasks() { return nextTasks; }
    public void setNextTasks(List<CareTaskDto> nextTasks) { this.nextTasks = nextTasks; }

    public List<TreatmentLabTestDto> getPendingLabTests() { return pendingLabTests; }
    public void setPendingLabTests(List<TreatmentLabTestDto> pendingLabTests) { this.pendingLabTests = pendingLabTests; }

    public String getNextFollowUpRecommendation() { return nextFollowUpRecommendation; }
    public void setNextFollowUpRecommendation(String nextFollowUpRecommendation) { this.nextFollowUpRecommendation = nextFollowUpRecommendation; }

    public String getFollowUpDoctorName() { return followUpDoctorName; }
    public void setFollowUpDoctorName(String followUpDoctorName) { this.followUpDoctorName = followUpDoctorName; }

    public UUID getFollowUpDoctorId() { return followUpDoctorId; }
    public void setFollowUpDoctorId(UUID followUpDoctorId) { this.followUpDoctorId = followUpDoctorId; }

    public Integer getTakenDosesToday() { return takenDosesToday; }
    public void setTakenDosesToday(Integer takenDosesToday) { this.takenDosesToday = takenDosesToday; }

    public Integer getTotalDosesToday() { return totalDosesToday; }
    public void setTotalDosesToday(Integer totalDosesToday) { this.totalDosesToday = totalDosesToday; }

    public Integer getCompletedTasksTotal() { return completedTasksTotal; }
    public void setCompletedTasksTotal(Integer completedTasksTotal) { this.completedTasksTotal = completedTasksTotal; }

    public Integer getPendingTasksTotal() { return pendingTasksTotal; }
    public void setPendingTasksTotal(Integer pendingTasksTotal) { this.pendingTasksTotal = pendingTasksTotal; }
}
