package com.app.record.service;

import com.app.doctor.repository.DoctorRepository;
import com.app.record.dto.*;
import com.app.record.entity.*;
import com.app.record.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TreatmentPlanService {

    private static final Logger log = LoggerFactory.getLogger(TreatmentPlanService.class);

    private final TreatmentPlanRepository treatmentPlanRepository;
    private final TreatmentMedicationRepository treatmentMedicationRepository;
    private final MedicationDoseLogRepository doseLogRepository;
    private final TreatmentLabTestRepository labTestRepository;
    private final CareTaskRepository careTaskRepository;
    private final DoctorRepository doctorRepository;

    public TreatmentPlanService(TreatmentPlanRepository treatmentPlanRepository,
                                TreatmentMedicationRepository treatmentMedicationRepository,
                                MedicationDoseLogRepository doseLogRepository,
                                TreatmentLabTestRepository labTestRepository,
                                CareTaskRepository careTaskRepository,
                                DoctorRepository doctorRepository) {
        this.treatmentPlanRepository = treatmentPlanRepository;
        this.treatmentMedicationRepository = treatmentMedicationRepository;
        this.doseLogRepository = doseLogRepository;
        this.labTestRepository = labTestRepository;
        this.careTaskRepository = careTaskRepository;
        this.doctorRepository = doctorRepository;
    }

    /**
     * Converts a doctor's prescription into a structured operational Treatment Plan.
     */
    @Transactional
    public TreatmentPlan createPlanFromPrescription(MedicalRecord record, DigitalPrescriptionRequest request) {
        log.info("Creating structured Treatment Plan for patient {}", request.getPatientId());

        LocalDate today = LocalDate.now();
        int maxDays = 5;

        // Parse max duration from medicines
        if (request.getMedicines() != null) {
            for (PrescriptionMedicine med : request.getMedicines()) {
                int days = parseDaysFromDuration(med.getDuration());
                if (days > maxDays) maxDays = days;
            }
        }

        LocalDate endDate = today.plusDays(maxDays);
        LocalDate followUpDate = null;
        if (request.getFollowUpDays() != null && request.getFollowUpDays() > 0) {
            followUpDate = today.plusDays(request.getFollowUpDays());
        } else {
            followUpDate = today.plusDays(Math.max(maxDays + 2, 7));
        }

        String title = request.getDiagnosis() != null && !request.getDiagnosis().isBlank()
                ? "Treatment Plan: " + request.getDiagnosis()
                : "Care Plan — " + today;

        TreatmentPlan plan = new TreatmentPlan();
        plan.setPatientId(request.getPatientId());
        plan.setDoctorId(request.getDoctorId());
        plan.setAppointmentId(request.getAppointmentId());
        plan.setMedicalRecordId(record != null ? record.getId() : null);
        plan.setTitle(title);
        plan.setDiagnosis(request.getDiagnosis() != null ? request.getDiagnosis() : "Clinical Consultation");
        plan.setInstructions(request.getNotes());
        plan.setStartDate(today);
        plan.setEndDate(endDate);
        plan.setFollowUpDate(followUpDate);
        plan.setStatus("ACTIVE");
        plan.setTotalMedications(request.getMedicines() != null ? request.getMedicines().size() : 0);

        TreatmentPlan savedPlan = treatmentPlanRepository.save(plan);

        int totalTasks = 0;

        // 1. Process Structured Medications & Dose Logs
        if (request.getMedicines() != null && !request.getMedicines().isEmpty()) {
            for (PrescriptionMedicine med : request.getMedicines()) {
                int durationDays = parseDaysFromDuration(med.getDuration());
                LocalDate medEndDate = today.plusDays(durationDays);

                TreatmentMedication tm = new TreatmentMedication();
                tm.setTreatmentPlanId(savedPlan.getId());
                tm.setMedicineName(med.getName());
                tm.setStrength(med.getStrength());
                tm.setDosage(med.getDosage() != null ? med.getDosage() : "1 tablet");
                tm.setFrequency(med.getFrequency() != null ? med.getFrequency() : "1-0-1");
                tm.setTotalDays(durationDays);
                tm.setStartDate(today);
                tm.setEndDate(medEndDate);
                tm.setInstructions("Take as directed (" + tm.getFrequency() + ")");
                tm.setStatus("ACTIVE");

                TreatmentMedication savedMed = treatmentMedicationRepository.save(tm);

                // Generate Dose Slots & Dose Logs for explicitly tracking patient confirmation
                List<String> slots = parseFrequencySlots(tm.getFrequency());
                for (int d = 0; d < durationDays; d++) {
                    LocalDate doseDate = today.plusDays(d);
                    for (String slot : slots) {
                        MedicationDoseLog dose = new MedicationDoseLog();
                        dose.setTreatmentMedicationId(savedMed.getId());
                        dose.setPatientId(request.getPatientId());
                        dose.setDoseDate(doseDate);
                        dose.setDoseSlot(slot);
                        dose.setStatus("SCHEDULED");
                        doseLogRepository.save(dose);
                    }
                }
            }
        }

        // 2. Process Lab Tests & Diagnostic Tasks
        if (request.getLabTests() != null && !request.getLabTests().isEmpty()) {
            for (String testName : request.getLabTests()) {
                if (testName == null || testName.isBlank()) continue;

                TreatmentLabTest labTest = new TreatmentLabTest();
                labTest.setTreatmentPlanId(savedPlan.getId());
                labTest.setPatientId(request.getPatientId());
                labTest.setTestName(testName.trim());
                labTest.setUrgency("ROUTINE");
                labTest.setDueDate(today.plusDays(2)); // Diagnostic due in 2 days
                labTest.setInstructions("Perform test at an accredited diagnostic lab");
                labTest.setStatus("PENDING");
                labTestRepository.save(labTest);

                // Create Care Task for Diagnostic
                CareTask task = new CareTask();
                task.setPatientId(request.getPatientId());
                task.setTreatmentPlanId(savedPlan.getId());
                task.setTaskType("LAB_TEST");
                task.setTitle("Lab Test: " + testName.trim());
                task.setDescription("Undergo prescribed diagnostic test: " + testName.trim());
                task.setDueDate(today.plusDays(2));
                task.setDueTimeSlot("MORNING");
                task.setPriority("HIGH");
                task.setStatus("PENDING");
                task.setReferenceId(labTest.getId());
                careTaskRepository.save(task);
                totalTasks++;

                // Create Care Task for Report Upload
                CareTask uploadTask = new CareTask();
                uploadTask.setPatientId(request.getPatientId());
                uploadTask.setTreatmentPlanId(savedPlan.getId());
                uploadTask.setTaskType("REPORT_UPLOAD");
                uploadTask.setTitle("Upload Report: " + testName.trim());
                uploadTask.setDescription("Upload your laboratory test report once results are ready");
                uploadTask.setDueDate(today.plusDays(3));
                uploadTask.setDueTimeSlot("ANYTIME");
                uploadTask.setPriority("MEDIUM");
                uploadTask.setStatus("PENDING");
                uploadTask.setReferenceId(labTest.getId());
                careTaskRepository.save(uploadTask);
                totalTasks++;
            }
        }

        // 3. Create Follow-up Review Care Task
        if (followUpDate != null) {
            CareTask followUpTask = new CareTask();
            followUpTask.setPatientId(request.getPatientId());
            followUpTask.setTreatmentPlanId(savedPlan.getId());
            followUpTask.setTaskType("FOLLOW_UP_CONSULTATION");
            followUpTask.setTitle("Doctor Follow-up Consultation");
            followUpTask.setDescription("Schedule review consultation to evaluate treatment response and recovery");
            followUpTask.setDueDate(followUpDate);
            followUpTask.setDueTimeSlot("ANYTIME");
            followUpTask.setPriority("HIGH");
            followUpTask.setStatus("PENDING");
            careTaskRepository.save(followUpTask);
            totalTasks++;
        }

        savedPlan.setTotalTasks(totalTasks);
        return treatmentPlanRepository.save(savedPlan);
    }

    /**
     * Explicitly confirm a patient's dose status (TAKEN or SKIPPED).
     */
    @Transactional
    public MedicationDoseLog confirmDose(UUID doseLogId, String status, String note) {
        MedicationDoseLog logEntry = doseLogRepository.findById(doseLogId)
                .orElseThrow(() -> new IllegalArgumentException("Dose log not found: " + doseLogId));

        String sanitizedStatus = "SKIPPED".equalsIgnoreCase(status) ? "SKIPPED" : "TAKEN";
        logEntry.setStatus(sanitizedStatus);
        logEntry.setConfirmedAt(LocalDateTime.now());
        if (note != null) {
            logEntry.setPatientNote(note);
        }

        return doseLogRepository.save(logEntry);
    }

    /**
     * Complete a care task.
     */
    @Transactional
    public CareTask completeCareTask(UUID taskId) {
        CareTask task = careTaskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Care task not found: " + taskId));

        task.setStatus("COMPLETED");
        task.setCompletedAt(LocalDateTime.now());
        CareTask saved = careTaskRepository.save(task);

        if (task.getTreatmentPlanId() != null) {
            treatmentPlanRepository.findById(task.getTreatmentPlanId()).ifPresent(plan -> {
                int completed = (int) careTaskRepository.findByTreatmentPlanId(plan.getId())
                        .stream().filter(t -> "COMPLETED".equals(t.getStatus())).count();
                plan.setCompletedTasks(completed);
                treatmentPlanRepository.save(plan);
            });
        }
        return saved;
    }

    public TreatmentPlanDto getPlanDtoById(UUID planId) {
        TreatmentPlan plan = treatmentPlanRepository.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("Treatment plan not found: " + planId));
        return toDto(plan);
    }

    public List<TreatmentPlanDto> getPlansByPatient(UUID patientId) {
        return treatmentPlanRepository.findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    public Optional<TreatmentPlanDto> getActivePlanDtoByPatient(UUID patientId) {
        return treatmentPlanRepository.findFirstByPatientIdAndStatusOrderByCreatedAtDesc(patientId, "ACTIVE")
                .map(this::toDto);
    }

    public TreatmentPlanDto toDto(TreatmentPlan plan) {
        TreatmentPlanDto dto = new TreatmentPlanDto();
        dto.setId(plan.getId());
        dto.setPatientId(plan.getPatientId());
        dto.setDoctorId(plan.getDoctorId());
        dto.setAppointmentId(plan.getAppointmentId());
        dto.setMedicalRecordId(plan.getMedicalRecordId());
        dto.setTitle(plan.getTitle());
        dto.setDiagnosis(plan.getDiagnosis());
        dto.setInstructions(plan.getInstructions());
        dto.setStartDate(plan.getStartDate());
        dto.setEndDate(plan.getEndDate());
        dto.setFollowUpDate(plan.getFollowUpDate());
        dto.setStatus(plan.getStatus());
        dto.setTotalMedications(plan.getTotalMedications());
        dto.setTotalTasks(plan.getTotalTasks());
        dto.setCompletedTasks(plan.getCompletedTasks());
        dto.setCreatedAt(plan.getCreatedAt());

        if (plan.getDoctorId() != null) {
            doctorRepository.findById(plan.getDoctorId()).ifPresent(doc -> {
                if (doc.getUser() != null) {
                    dto.setDoctorName(doc.getUser().getFullName());
                } else if (doc.getEmail() != null) {
                    dto.setDoctorName(doc.getEmail());
                }
            });
        }

        // Progress percentage calculation
        if (plan.getTotalTasks() != null && plan.getTotalTasks() > 0) {
            int completed = plan.getCompletedTasks() != null ? plan.getCompletedTasks() : 0;
            dto.setProgressPercentage(Math.min(100.0, ((double) completed / plan.getTotalTasks()) * 100.0));
        } else {
            dto.setProgressPercentage(0.0);
        }

        // Medications
        List<TreatmentMedication> meds = treatmentMedicationRepository.findByTreatmentPlanId(plan.getId());
        LocalDate today = LocalDate.now();
        List<TreatmentMedicationDto> medDtos = meds.stream().map(m -> {
            TreatmentMedicationDto md = new TreatmentMedicationDto();
            md.setId(m.getId());
            md.setTreatmentPlanId(m.getTreatmentPlanId());
            md.setPrescriptionItemId(m.getPrescriptionItemId());
            md.setMedicineName(m.getMedicineName());
            md.setStrength(m.getStrength());
            md.setDosage(m.getDosage());
            md.setFrequency(m.getFrequency());
            md.setTotalDays(m.getTotalDays());
            md.setStartDate(m.getStartDate());
            md.setEndDate(m.getEndDate());
            md.setInstructions(m.getInstructions());
            md.setStatus(m.getStatus());

            if (m.getStartDate() != null) {
                long dayDiff = java.time.temporal.ChronoUnit.DAYS.between(m.getStartDate(), today) + 1;
                md.setDayNumber(Math.max(1, (int) Math.min(dayDiff, m.getTotalDays() != null ? m.getTotalDays() : 1)));
            }

            // Today's dose logs for this medication
            List<MedicationDoseLog> todayLogs = doseLogRepository.findByTreatmentMedicationIdOrderByDoseDateAsc(m.getId())
                    .stream().filter(l -> today.equals(l.getDoseDate())).collect(Collectors.toList());

            List<MedicationDoseLogDto> logDtos = todayLogs.stream().map(l -> {
                MedicationDoseLogDto ld = new MedicationDoseLogDto();
                ld.setId(l.getId());
                ld.setTreatmentMedicationId(l.getTreatmentMedicationId());
                ld.setMedicineName(m.getMedicineName());
                ld.setDosage(m.getDosage());
                ld.setPatientId(l.getPatientId());
                ld.setDoseDate(l.getDoseDate());
                ld.setDoseSlot(l.getDoseSlot());
                ld.setStatus(l.getStatus());
                ld.setConfirmedAt(l.getConfirmedAt());
                ld.setPatientNote(l.getPatientNote());
                return ld;
            }).collect(Collectors.toList());

            md.setTodayDoses(logDtos);
            return md;
        }).collect(Collectors.toList());
        dto.setMedications(medDtos);

        // Lab tests
        List<TreatmentLabTest> labTests = labTestRepository.findByTreatmentPlanId(plan.getId());
        List<TreatmentLabTestDto> labDtos = labTests.stream().map(l -> {
            TreatmentLabTestDto ld = new TreatmentLabTestDto();
            ld.setId(l.getId());
            ld.setTreatmentPlanId(l.getTreatmentPlanId());
            ld.setPatientId(l.getPatientId());
            ld.setTestName(l.getTestName());
            ld.setUrgency(l.getUrgency());
            ld.setDueDate(l.getDueDate());
            ld.setInstructions(l.getInstructions());
            ld.setStatus(l.getStatus());
            ld.setReportId(l.getReportId());
            return ld;
        }).collect(Collectors.toList());
        dto.setLabTests(labDtos);

        // Tasks
        List<CareTask> tasks = careTaskRepository.findByTreatmentPlanId(plan.getId());
        List<CareTaskDto> taskDtos = tasks.stream().map(t -> {
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
        }).collect(Collectors.toList());
        dto.setTasks(taskDtos);

        return dto;
    }

    private int parseDaysFromDuration(String duration) {
        if (duration == null || duration.isBlank()) return 5;
        try {
            String digits = duration.replaceAll("[^0-9]", "").trim();
            if (!digits.isEmpty()) {
                int val = Integer.parseInt(digits);
                if (duration.toLowerCase().contains("week")) return val * 7;
                if (duration.toLowerCase().contains("month")) return val * 30;
                return val;
            }
        } catch (Exception e) {
            log.warn("Could not parse duration: {}", duration);
        }
        return 5;
    }

    private List<String> parseFrequencySlots(String freq) {
        List<String> slots = new ArrayList<>();
        if (freq == null || freq.isBlank()) {
            slots.add("MORNING");
            slots.add("NIGHT");
            return slots;
        }

        String f = freq.trim();
        if (f.equals("1-0-1")) {
            slots.add("MORNING");
            slots.add("NIGHT");
        } else if (f.equals("1-1-1")) {
            slots.add("MORNING");
            slots.add("AFTERNOON");
            slots.add("NIGHT");
        } else if (f.equals("1-0-0")) {
            slots.add("MORNING");
        } else if (f.equals("0-0-1")) {
            slots.add("NIGHT");
        } else if (f.equals("0-1-0")) {
            slots.add("AFTERNOON");
        } else if (f.toLowerCase().contains("twice")) {
            slots.add("MORNING");
            slots.add("NIGHT");
        } else if (f.toLowerCase().contains("thrice")) {
            slots.add("MORNING");
            slots.add("AFTERNOON");
            slots.add("NIGHT");
        } else {
            slots.add("MORNING");
        }
        return slots;
    }
}
