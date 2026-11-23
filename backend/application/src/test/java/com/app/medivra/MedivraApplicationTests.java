package com.app.medivra;

import com.app.appointment.entity.Appointment;
import com.app.appointment.entity.AppointmentStatus;
import com.app.appointment.entity.ConsultationType;
import com.app.appointment.repository.AppointmentRepository;
import com.app.doctor.entity.Doctor;
import com.app.doctor.repository.DoctorRepository;
import com.app.record.dto.DigitalPrescriptionRequest;
import com.app.record.dto.NextActionResponse;
import com.app.record.dto.PrescriptionMedicine;
import com.app.record.dto.HealthTimelineEventDto;
import com.app.record.entity.MedicalRecord;
import com.app.record.service.HealthTimelineService;
import com.app.record.service.MedicalRecordService;
import com.app.record.service.NextActionService;
import com.app.record.service.TreatmentPlanService;
import com.app.user.entity.Role;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class MedivraApplicationTests {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private MedicalRecordService medicalRecordService;

    @Autowired
    private NextActionService nextActionService;

    @Autowired
    private HealthTimelineService healthTimelineService;

    @Autowired
    private TreatmentPlanService treatmentPlanService;

    @Autowired
    private com.app.ai.controller.HealthJourneyController healthJourneyController;

    @Test
    void testCompleteConsultationThenDigitalPrescriptionFlow() {
        // 1. Create Patient User
        User patient = new User();
        patient.setEmail("testpatient_" + UUID.randomUUID() + "@test.com");
        patient.setPassword("hashed_password");
        patient.setFullName("Test Patient");
        patient.setRole("ROLE_PATIENT");
        patient = userRepository.save(patient);

        // 2. Create Doctor User and Doctor Profile
        User docUser = new User();
        docUser.setEmail("testdoc_" + UUID.randomUUID() + "@test.com");
        docUser.setPassword("hashed_password");
        docUser.setFullName("Test Doctor");
        docUser.setRole("ROLE_DOCTOR");
        docUser = userRepository.save(docUser);

        Doctor doctor = new Doctor();
        doctor.setUser(docUser);
        doctor.setUserId(docUser.getId());
        doctor.setEmail(docUser.getEmail());
        doctor.setSpecialization("Cardiology");
        doctor.setLicenseNumber("MED-12345");
        doctor.setExperienceYears(10);
        doctor.setHospitalName("Apollo Hospital");
        doctor.setCity("Delhi");
        doctor.setConsultationFee(new java.math.BigDecimal("500"));
        doctor = doctorRepository.save(doctor);

        // 3. Create Appointment for tomorrow (future date)
        Appointment apt = new Appointment();
        apt.setPatient(patient);
        apt.setDoctor(doctor);
        apt.setAppointmentDate(LocalDate.now().plusDays(2)); // Future date
        apt.setTimeSlot("10:00 AM");
        apt.setStatus(AppointmentStatus.CONFIRMED);
        apt.setConsultationType(ConsultationType.ONLINE);
        apt = appointmentRepository.save(apt);

        // 4. Complete the consultation before actual date
        apt.setStatus(AppointmentStatus.COMPLETED);
        apt = appointmentRepository.save(apt);

        // 5. Doctor submits Digital Prescription afterwards
        DigitalPrescriptionRequest req = new DigitalPrescriptionRequest();
        req.setAppointmentId(apt.getId());
        req.setDoctorId(doctor.getId());
        req.setPatientId(patient.getId());
        req.setDiagnosis("Hypertension Stage 1");
        req.setNotes("Take medications regularly and avoid salt");
        req.setFollowUpDays(7);

        PrescriptionMedicine med1 = new PrescriptionMedicine();
        med1.setName("Amlodipine");
        med1.setStrength("5mg");
        med1.setDosage("1 tablet");
        med1.setFrequency("1-0-1");
        med1.setDuration("5 days");

        req.setMedicines(List.of(med1));
        req.setLabTests(List.of("Lipid Profile"));

        MedicalRecord record = medicalRecordService.createDigitalPrescription(req);
        assertNotNull(record);
        assertNotNull(record.getId());

        // 6. Test Next Actions for patient
        NextActionResponse nextActions = nextActionService.getNextActionsForPatient(patient.getId());
        assertNotNull(nextActions);
        assertNotNull(nextActions.getActivePlan(), "Active Plan must not be null");
        assertEquals("Hypertension Stage 1", nextActions.getActivePlan().getDiagnosis());
        assertFalse(nextActions.getTodayDoses().isEmpty(), "Today's doses must be populated");
        assertEquals("Amlodipine", nextActions.getTodayDoses().get(0).getMedicineName());

        // 7. Test Health Timeline
        List<HealthTimelineEventDto> timeline = healthTimelineService.getTimelineForPatient(patient.getId());
        assertFalse(timeline.isEmpty(), "Timeline must not be empty");
        boolean hasPrescriptionEvent = timeline.stream().anyMatch(e -> "PRESCRIPTION".equals(e.getEventType()));
        boolean hasConsultationEvent = timeline.stream().anyMatch(e -> "CONSULTATION".equals(e.getEventType()));
        assertTrue(hasPrescriptionEvent, "Timeline must contain PRESCRIPTION event");
        assertTrue(hasConsultationEvent, "Timeline must contain CONSULTATION event");

        // 8. Test HealthJourneyController dashboard endpoint directly
        var dashResponse = healthJourneyController.getPatientDashboard(patient.getId());
        assertEquals(200, dashResponse.getStatusCode().value());
        assertNotNull(dashResponse.getBody());
        assertTrue(dashResponse.getBody().containsKey("nextActions"));
        assertTrue(dashResponse.getBody().containsKey("recentTimeline"));
        NextActionResponse dashNextActions = (NextActionResponse) dashResponse.getBody().get("nextActions");
        assertNotNull(dashNextActions.getActivePlan());
        assertEquals(2, dashNextActions.getTodayDoses().size());

        System.out.println("TEST PASSED: ActivePlan=" + nextActions.getActivePlan().getTitle()
                + ", Doses=" + nextActions.getTodayDoses().size()
                + ", TimelineEvents=" + timeline.size()
                + ", ControllerDashboard=" + dashResponse.getStatusCode());
    }

    @Test
    void testExistingPatientDashboard() {
        UUID patientId = UUID.fromString("324ccb21-081b-4b33-bec1-02b9adec8995");
        var res = healthJourneyController.getPatientDashboard(patientId);
        System.out.println("EXISTING PATIENT STATUS: " + res.getStatusCode());
        System.out.println("EXISTING PATIENT BODY KEYS: " + res.getBody().keySet());
        NextActionResponse na = (NextActionResponse) res.getBody().get("nextActions");
        System.out.println("EXISTING PATIENT ACTIVE PLAN: " + (na.getActivePlan() != null ? na.getActivePlan().getTitle() : "NULL"));
        System.out.println("EXISTING PATIENT DOSES: " + na.getTodayDoses().size());
        System.out.println("EXISTING PATIENT TIMELINE SIZE: " + ((List<?>) res.getBody().get("recentTimeline")).size());
    }

}

