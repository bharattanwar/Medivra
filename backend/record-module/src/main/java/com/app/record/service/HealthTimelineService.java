package com.app.record.service;

import com.app.appointment.entity.Appointment;
import com.app.appointment.repository.AppointmentRepository;
import com.app.doctor.entity.Doctor;
import com.app.doctor.repository.DoctorRepository;
import com.app.record.dto.HealthTimelineEventDto;
import com.app.record.entity.*;
import com.app.record.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class HealthTimelineService {

    private final AppointmentRepository appointmentRepository;
    private final RecordRepository recordRepository;
    private final PrescriptionItemRepository prescriptionItemRepository;
    private final TreatmentPlanRepository treatmentPlanRepository;
    private final MedicationDoseLogRepository doseLogRepository;
    private final CareTaskRepository careTaskRepository;
    private final LabReportParameterRepository labReportParameterRepository;
    private final DoctorRepository doctorRepository;

    public HealthTimelineService(AppointmentRepository appointmentRepository,
                                 RecordRepository recordRepository,
                                 PrescriptionItemRepository prescriptionItemRepository,
                                 TreatmentPlanRepository treatmentPlanRepository,
                                 MedicationDoseLogRepository doseLogRepository,
                                 CareTaskRepository careTaskRepository,
                                 LabReportParameterRepository labReportParameterRepository,
                                 DoctorRepository doctorRepository) {
        this.appointmentRepository = appointmentRepository;
        this.recordRepository = recordRepository;
        this.prescriptionItemRepository = prescriptionItemRepository;
        this.treatmentPlanRepository = treatmentPlanRepository;
        this.doseLogRepository = doseLogRepository;
        this.careTaskRepository = careTaskRepository;
        this.labReportParameterRepository = labReportParameterRepository;
        this.doctorRepository = doctorRepository;
    }

    /**
     * Projects a unified chronological timeline for a patient by referencing existing domain records.
     */
    @Transactional(readOnly = true)
    public List<HealthTimelineEventDto> getTimelineForPatient(UUID patientId) {
        List<HealthTimelineEventDto> timeline = new ArrayList<>();

        // 1. Appointments & Consultations
        List<Appointment> appointments = appointmentRepository.findByPatientIdOrderByAppointmentDateDesc(patientId);
        for (Appointment apt : appointments) {
            HealthTimelineEventDto event = new HealthTimelineEventDto();
            event.setId("apt-" + apt.getId());
            event.setEventType("CONSULTATION");
            event.setTimestamp(apt.getCreatedAt() != null ? apt.getCreatedAt() : LocalDateTime.now());
            
            String docName = "Doctor";
            if (apt.getDoctor() != null) {
                Doctor d = apt.getDoctor();
                docName = d.getUser() != null ? "Dr. " + d.getUser().getFullName() : (d.getEmail() != null ? "Dr. " + d.getEmail() : "Doctor");
            }
            
            event.setTitle("Consultation with " + docName);
            event.setSubtitle("Slot: " + apt.getAppointmentDate() + " (" + apt.getTimeSlot() + ")");
            event.setDescription("Mode: " + (apt.getConsultationType() != null ? apt.getConsultationType().name() : "Online"));
            String statusStr = apt.getStatus() != null ? apt.getStatus().name() : "PENDING";
            event.setStatus(statusStr);
            event.setStatusBadgeColor("COMPLETED".equalsIgnoreCase(statusStr) ? "emerald" : "blue");
            event.setIconType("Stethoscope");
            event.setReferenceId(apt.getId());
            event.setActionUrl("/consultation/" + apt.getId());
            timeline.add(event);
        }

        // 2. Prescriptions / Medical Records
        List<MedicalRecord> records = recordRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
        for (MedicalRecord rec : records) {
            HealthTimelineEventDto event = new HealthTimelineEventDto();
            event.setId("rec-" + rec.getId());
            event.setEventType("PRESCRIPTION");
            event.setTimestamp(rec.getCreatedAt() != null ? rec.getCreatedAt() : LocalDateTime.now());
            event.setTitle("E-Prescription Issued");

            List<PrescriptionItem> items = prescriptionItemRepository.findByMedicalRecordId(rec.getId());
            String medList = items.stream().map(PrescriptionItem::getMedicineName).reduce((a, b) -> a + ", " + b).orElse("Prescribed medications");
            event.setSubtitle(items.size() + " medications prescribed");
            event.setDescription(medList);
            event.setStatus("ISSUED");
            event.setStatusBadgeColor("indigo");
            event.setIconType("Pill");
            event.setReferenceId(rec.getId());
            event.setActionUrl("/api/records/view/" + rec.getFilePath());
            timeline.add(event);
        }

        // 3. Treatment Plans
        List<TreatmentPlan> plans = treatmentPlanRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
        for (TreatmentPlan plan : plans) {
            HealthTimelineEventDto event = new HealthTimelineEventDto();
            event.setId("plan-" + plan.getId());
            event.setEventType("TREATMENT_PLAN");
            event.setTimestamp(plan.getCreatedAt() != null ? plan.getCreatedAt() : LocalDateTime.now());
            event.setTitle("Treatment Plan Initiated: " + plan.getTitle());
            event.setSubtitle("Diagnosis: " + plan.getDiagnosis());
            event.setDescription("Duration: " + plan.getStartDate() + " to " + (plan.getEndDate() != null ? plan.getEndDate() : "Ongoing"));
            event.setStatus(plan.getStatus());
            event.setStatusBadgeColor("purple");
            event.setIconType("Activity");
            event.setReferenceId(plan.getId());
            event.setActionUrl("/patient/journey");
            timeline.add(event);
        }

        // 4. Lab Reports & Diagnostic Parameters
        List<LabReportParameter> params = labReportParameterRepository.findByPatientIdOrderByTestDateDesc(patientId);
        Map<String, List<LabReportParameter>> paramsByReportOrDate = new HashMap<>();
        for (LabReportParameter p : params) {
            String key = p.getReportId() != null ? p.getReportId().toString() : p.getTestDate().toString();
            paramsByReportOrDate.computeIfAbsent(key, k -> new ArrayList<>()).add(p);
        }

        for (Map.Entry<String, List<LabReportParameter>> entry : paramsByReportOrDate.entrySet()) {
            List<LabReportParameter> group = entry.getValue();
            if (group.isEmpty()) continue;
            LabReportParameter first = group.get(0);

            HealthTimelineEventDto event = new HealthTimelineEventDto();
            event.setId("lab-" + entry.getKey());
            event.setEventType("LAB_REPORT");
            event.setTimestamp(first.getCreatedAt() != null ? first.getCreatedAt() : first.getTestDate().atStartOfDay());
            event.setTitle(first.getTestCategory() != null ? first.getTestCategory() + " Report" : "Diagnostic Lab Report");
            
            String summary = group.stream().map(g -> g.getParameterName() + ": " + g.getRawValue() + " " + (g.getUnit() != null ? g.getUnit() : "") + " [" + g.getFlag() + "]")
                    .reduce((a, b) -> a + " • " + b).orElse("Structured findings recorded");
            
            event.setSubtitle(group.size() + " structured parameters analyzed");
            event.setDescription(summary);
            event.setStatus("ANALYZED");
            event.setStatusBadgeColor("teal");
            event.setIconType("FileText");
            event.setReferenceId(first.getReportId());
            timeline.add(event);
        }

        // 5. Completed Care Tasks
        List<CareTask> completedTasks = careTaskRepository.findByPatientIdAndStatus(patientId, "COMPLETED");
        for (CareTask task : completedTasks) {
            HealthTimelineEventDto event = new HealthTimelineEventDto();
            event.setId("task-" + task.getId());
            event.setEventType("CARE_TASK");
            event.setTimestamp(task.getCompletedAt() != null ? task.getCompletedAt() : task.getUpdatedAt() != null ? task.getUpdatedAt() : LocalDateTime.now());
            event.setTitle("Completed Task: " + task.getTitle());
            event.setSubtitle("Category: " + task.getTaskType());
            event.setDescription(task.getDescription() != null ? task.getDescription() : "Action item confirmed by patient");
            event.setStatus("COMPLETED");
            event.setStatusBadgeColor("emerald");
            event.setIconType("CheckCircle2");
            event.setReferenceId(task.getId());
            timeline.add(event);
        }

        // Sort descending by timestamp
        timeline.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));
        return timeline;
    }
}
