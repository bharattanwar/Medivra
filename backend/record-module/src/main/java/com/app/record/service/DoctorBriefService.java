package com.app.record.service;

import com.app.appointment.entity.Appointment;
import com.app.appointment.repository.AppointmentRepository;
import com.app.doctor.entity.Doctor;
import com.app.doctor.repository.DoctorRepository;
import com.app.record.dto.*;
import com.app.record.entity.*;
import com.app.record.repository.*;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class DoctorBriefService {

    private final TreatmentPlanService treatmentPlanService;
    private final DeterministicLabService deterministicLabService;
    private final MedicationDoseLogRepository doseLogRepository;
    private final CareTaskRepository careTaskRepository;
    private final TreatmentLabTestRepository labTestRepository;
    private final AppointmentRepository appointmentRepository;
    private final RecordRepository recordRepository;
    private final PrescriptionItemRepository prescriptionItemRepository;
    private final UserRepository userRepository;
    private final DoctorRepository doctorRepository;

    public DoctorBriefService(TreatmentPlanService treatmentPlanService,
                              DeterministicLabService deterministicLabService,
                              MedicationDoseLogRepository doseLogRepository,
                              CareTaskRepository careTaskRepository,
                              TreatmentLabTestRepository labTestRepository,
                              AppointmentRepository appointmentRepository,
                              RecordRepository recordRepository,
                              PrescriptionItemRepository prescriptionItemRepository,
                              UserRepository userRepository,
                              DoctorRepository doctorRepository) {
        this.treatmentPlanService = treatmentPlanService;
        this.deterministicLabService = deterministicLabService;
        this.doseLogRepository = doseLogRepository;
        this.careTaskRepository = careTaskRepository;
        this.labTestRepository = labTestRepository;
        this.appointmentRepository = appointmentRepository;
        this.recordRepository = recordRepository;
        this.prescriptionItemRepository = prescriptionItemRepository;
        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
    }

    /**
     * Generates a concise pre-consultation clinical summary for a doctor.
     */
    @Transactional(readOnly = true)
    public DoctorBriefResponse generateBrief(UUID patientId) {
        DoctorBriefResponse brief = new DoctorBriefResponse();
        brief.setPatientId(patientId);

        // 1. Patient Profile Info
        userRepository.findById(patientId).ifPresent(u -> {
            brief.setPatientName(u.getFullName());
        });

        // 2. Active Treatment Plan
        Optional<TreatmentPlanDto> activePlanOpt = treatmentPlanService.getActivePlanDtoByPatient(patientId);
        if (activePlanOpt.isPresent()) {
            TreatmentPlanDto plan = activePlanOpt.get();
            brief.setActiveTreatmentPlan(plan);
            brief.setActiveDiagnosis(plan.getDiagnosis());
            brief.setTreatmentStartDate(plan.getStartDate());
            brief.setTargetFollowUpDate(plan.getFollowUpDate());
        }

        // 3. Explicit Intake Adherence (Objective Patient Confirmed Data Only)
        List<Object[]> statusCounts = doseLogRepository.countStatusByPatientId(patientId);
        int taken = 0;
        int skipped = 0;
        int scheduled = 0;

        for (Object[] row : statusCounts) {
            String status = (String) row[0];
            long count = (Long) row[1];
            if ("TAKEN".equalsIgnoreCase(status)) {
                taken += (int) count;
            } else if ("SKIPPED".equalsIgnoreCase(status)) {
                skipped += (int) count;
            } else if ("SCHEDULED".equalsIgnoreCase(status)) {
                scheduled += (int) count;
            }
        }

        int total = taken + skipped + scheduled;
        brief.setTotalDosesScheduled(total);
        brief.setDosesConfirmedTaken(taken);
        brief.setDosesMarkedSkipped(skipped);
        brief.setDosesNotReported(scheduled);

        String note = String.format("%d doses confirmed taken, %d doses marked as skipped, %d scheduled / pending confirmation",
                taken, skipped, scheduled);
        brief.setAdherenceSummaryNote(note);

        // 4. Deterministic Lab Parameter Trends
        List<LabTrendResponse> trends = deterministicLabService.getLabTrendsForPatient(patientId);
        brief.setLabTrends(trends);

        // 5. Previous Consultation & Prescription
        List<Appointment> pastAppointments = appointmentRepository.findByPatientIdOrderByAppointmentDateDesc(patientId).stream()
                .filter(a -> a.getStatus() != null && "COMPLETED".equalsIgnoreCase(a.getStatus().name()))
                .collect(Collectors.toList());

        if (!pastAppointments.isEmpty()) {
            Appointment lastApt = pastAppointments.get(0);
            brief.setLastConsultationDate(lastApt.getAppointmentDate() + " (" + lastApt.getTimeSlot() + ")");

            if (lastApt.getDoctor() != null) {
                Doctor d = lastApt.getDoctor();
                String dName = d.getUser() != null ? "Dr. " + d.getUser().getFullName() : (d.getEmail() != null ? "Dr. " + d.getEmail() : "Doctor");
                brief.setLastDoctorName(dName);
            }

            // Find associated medical record
            recordRepository.findByAppointmentId(lastApt.getId()).ifPresent(rec -> {
                brief.setLastDoctorNotes(rec.getNotes());
                List<PrescriptionItem> items = prescriptionItemRepository.findByMedicalRecordId(rec.getId());
                String rxSummary = items.stream().map(i -> i.getMedicineName() + " (" + i.getDosage() + ", " + i.getFrequency() + ")")
                        .reduce((a, b) -> a + "; " + b).orElse("No medications recorded");
                brief.setLastPrescriptionSummary(rxSummary);
            });
        }

        // 6. Pending Care Tasks & Lab Tests
        List<CareTask> pendingTasks = careTaskRepository.findByPatientIdAndStatus(patientId, "PENDING");
        brief.setPendingCareTasks(pendingTasks.stream().map(t -> {
            CareTaskDto td = new CareTaskDto();
            td.setId(t.getId());
            td.setTitle(t.getTitle());
            td.setDescription(t.getDescription());
            td.setTaskType(t.getTaskType());
            td.setDueDate(t.getDueDate());
            td.setDueTimeSlot(t.getDueTimeSlot());
            td.setPriority(t.getPriority());
            td.setStatus(t.getStatus());
            return td;
        }).collect(Collectors.toList()));

        List<TreatmentLabTest> pendingTests = labTestRepository.findByPatientIdAndStatus(patientId, "PENDING");
        brief.setPendingLabTests(pendingTests.stream().map(t -> {
            TreatmentLabTestDto td = new TreatmentLabTestDto();
            td.setId(t.getId());
            td.setTestName(t.getTestName());
            td.setUrgency(t.getUrgency());
            td.setDueDate(t.getDueDate());
            td.setStatus(t.getStatus());
            return td;
        }).collect(Collectors.toList()));

        return brief;
    }
}
