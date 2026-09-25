package com.app.record.service;

import com.app.doctor.repository.DoctorRepository;
import com.app.record.dto.*;
import com.app.record.entity.*;
import com.app.record.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class NextActionService {

    private final TreatmentPlanService treatmentPlanService;
    private final MedicationDoseLogRepository doseLogRepository;
    private final TreatmentMedicationRepository treatmentMedicationRepository;
    private final CareTaskRepository careTaskRepository;
    private final TreatmentLabTestRepository labTestRepository;
    private final DoctorRepository doctorRepository;

    public NextActionService(TreatmentPlanService treatmentPlanService,
                             MedicationDoseLogRepository doseLogRepository,
                             TreatmentMedicationRepository treatmentMedicationRepository,
                             CareTaskRepository careTaskRepository,
                             TreatmentLabTestRepository labTestRepository,
                             DoctorRepository doctorRepository) {
        this.treatmentPlanService = treatmentPlanService;
        this.doseLogRepository = doseLogRepository;
        this.treatmentMedicationRepository = treatmentMedicationRepository;
        this.careTaskRepository = careTaskRepository;
        this.labTestRepository = labTestRepository;
        this.doctorRepository = doctorRepository;
    }

    @Transactional(readOnly = true)
    public NextActionResponse getNextActionsForPatient(UUID patientId) {
        LocalDate today = LocalDate.now();
        NextActionResponse response = new NextActionResponse();
        response.setPatientId(patientId);

        // 1. Active Treatment Plan
        Optional<TreatmentPlanDto> activePlanOpt = treatmentPlanService.getActivePlanDtoByPatient(patientId);
        activePlanOpt.ifPresent(response::setActivePlan);

        // 2. Today's Medication Doses
        List<MedicationDoseLog> todayLogs = doseLogRepository.findByPatientIdAndDoseDate(patientId, today);
        Map<UUID, TreatmentMedication> medCache = new HashMap<>();

        List<MedicationDoseLogDto> todayDoseDtos = todayLogs.stream().map(log -> {
            MedicationDoseLogDto dto = new MedicationDoseLogDto();
            dto.setId(log.getId());
            dto.setTreatmentMedicationId(log.getTreatmentMedicationId());
            dto.setPatientId(log.getPatientId());
            dto.setDoseDate(log.getDoseDate());
            dto.setDoseSlot(log.getDoseSlot());
            dto.setStatus(log.getStatus());
            dto.setConfirmedAt(log.getConfirmedAt());
            dto.setPatientNote(log.getPatientNote());

            TreatmentMedication med = medCache.computeIfAbsent(log.getTreatmentMedicationId(),
                    id -> treatmentMedicationRepository.findById(id).orElse(null));
            if (med != null) {
                dto.setMedicineName(med.getMedicineName());
                dto.setDosage(med.getDosage() != null ? med.getDosage() : "1 dose");
            }
            return dto;
        }).collect(Collectors.toList());
        response.setTodayDoses(todayDoseDtos);

        // Count taken vs total doses today
        int takenToday = (int) todayDoseDtos.stream().filter(d -> "TAKEN".equals(d.getStatus())).count();
        response.setTakenDosesToday(takenToday);
        response.setTotalDosesToday(todayDoseDtos.size());

        // 3. Today's Care Tasks
        List<CareTask> todayTasks = careTaskRepository.findByPatientIdAndDueDate(patientId, today);
        response.setTodayTasks(todayTasks.stream().map(this::toTaskDto).collect(Collectors.toList()));

        // 4. Next/Upcoming Care Tasks (due tomorrow through next 14 days)
        List<CareTask> upcomingTasks = careTaskRepository.findByPatientIdAndDueDateBetweenOrderByDueDateAsc(
                patientId, today.plusDays(1), today.plusDays(14));
        response.setNextTasks(upcomingTasks.stream().map(this::toTaskDto).collect(Collectors.toList()));

        // 5. Pending Lab Tests
        List<TreatmentLabTest> pendingTests = labTestRepository.findByPatientIdAndStatus(patientId, "PENDING");
        response.setPendingLabTests(pendingTests.stream().map(t -> {
            TreatmentLabTestDto td = new TreatmentLabTestDto();
            td.setId(t.getId());
            td.setTreatmentPlanId(t.getTreatmentPlanId());
            td.setPatientId(t.getPatientId());
            td.setTestName(t.getTestName());
            td.setUrgency(t.getUrgency());
            td.setDueDate(t.getDueDate());
            td.setInstructions(t.getInstructions());
            td.setStatus(t.getStatus());
            td.setReportId(t.getReportId());
            return td;
        }).collect(Collectors.toList()));

        // 6. Follow-up consultation recommendation
        if (activePlanOpt.isPresent()) {
            TreatmentPlanDto plan = activePlanOpt.get();
            if (plan.getFollowUpDate() != null) {
                response.setNextFollowUpRecommendation("Review Consultation recommended on " + plan.getFollowUpDate());
                response.setFollowUpDoctorId(plan.getDoctorId());
                response.setFollowUpDoctorName(plan.getDoctorName());
            }
        }

        // 7. Overall Task Counts
        response.setCompletedTasksTotal((int) careTaskRepository.countCompletedByPatientId(patientId));
        response.setPendingTasksTotal((int) careTaskRepository.countPendingByPatientId(patientId));

        return response;
    }

    private CareTaskDto toTaskDto(CareTask t) {
        CareTaskDto td = new CareTaskDto();
        td.setId(t.getId());
        td.setPatientId(t.getPatientId());
        td.setTreatmentPlanId(t.getTreatmentPlanId());
        td.setTaskType(t.getTaskType());
        td.setTitle(t.getTitle());
        td.setDescription(t.getDescription());
        td.setDueDate(t.getDueDate());
        td.setDueTimeSlot(t.getDueTimeSlot());
        td.setPriority(t.getPriority());
        td.setStatus(t.getStatus());
        td.setReferenceId(t.getReferenceId());
        td.setCompletedAt(t.getCompletedAt());
        return td;
    }
}
