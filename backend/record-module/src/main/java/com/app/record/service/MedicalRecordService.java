package com.app.record.service;

import com.app.common.entity.NotificationType;
import com.app.common.event.NotificationEvent;
import com.app.record.dto.DigitalPrescriptionRequest;
import com.app.record.dto.PrescriptionMedicine;
import com.app.record.entity.MedicalRecord;
import com.app.record.entity.PrescriptionItem;
import com.app.record.repository.PrescriptionItemRepository;
import com.app.record.repository.RecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Service managing electronic medical records, digital e-prescription rendering,
 * external prescription ingestion, and prescription item extractions.
 *
 * Capabilities:
 * - uploadPrescription: Uploads a physical prescription scan attached to an appointment.
 * - createDigitalPrescription: Programmatically renders a formatted prescription image (Rx canvas),
 *   persists record metadata, and saves structured prescription items in bulk.
 * - uploadExternalPrescription: Allows patients to upload standalone historical prescriptions.
 * - verifyMedicines: Updates OCR-extracted prescription items after manual doctor/patient review.
 */
@Service
public class MedicalRecordService {

    private static final Logger log = LoggerFactory.getLogger(MedicalRecordService.class);

    private final RecordRepository recordRepository;
    private final FileStorageService fileStorageService;
    private final ApplicationEventPublisher eventPublisher;
    private final PrescriptionItemRepository prescriptionItemRepository;
    private final TreatmentPlanService treatmentPlanService;
    private final com.app.user.repository.UserRepository userRepository;
    private final com.app.doctor.repository.DoctorRepository doctorRepository;

    public MedicalRecordService(RecordRepository recordRepository,
                                FileStorageService fileStorageService,
                                ApplicationEventPublisher eventPublisher,
                                PrescriptionItemRepository prescriptionItemRepository,
                                TreatmentPlanService treatmentPlanService,
                                com.app.user.repository.UserRepository userRepository,
                                com.app.doctor.repository.DoctorRepository doctorRepository) {
        this.recordRepository = recordRepository;
        this.fileStorageService = fileStorageService;
        this.eventPublisher = eventPublisher;
        this.prescriptionItemRepository = prescriptionItemRepository;
        this.treatmentPlanService = treatmentPlanService;
        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
    }

    /**
     * Stores an uploaded prescription document from a consultation and creates
     * initial structured prescription items for medication matching.
     */
    @Transactional
    public MedicalRecord uploadPrescription(UUID appointmentId, UUID doctorId, UUID patientId,
                                            String notes, MultipartFile file) {
        String filename = fileStorageService.save(file);

        MedicalRecord record = new MedicalRecord();
        record.setAppointmentId(appointmentId);
        record.setDoctorId(doctorId);
        record.setPatientId(patientId);
        record.setNotes(notes);
        record.setFilePath(filename);
        record.setFileType(file.getContentType());

        MedicalRecord saved = recordRepository.save(record);

        // Simulated AI/OCR extraction for uploaded prescription file
        String[][] mockMeds = {
                {"Paracetamol", "500mg", "1 tablet", "1-0-1", "5 days"},
                {"Cetirizine", "10mg", "1 tablet", "0-0-1", "7 days"},
                {"Ibuprofen", "400mg", "1 tablet", "1-0-1", "3 days"}
        };

        List<PrescriptionItem> items = new ArrayList<>();
        for (String[] mockMed : mockMeds) {
            PrescriptionItem item = new PrescriptionItem();
            item.setMedicalRecordId(saved.getId());
            item.setMedicineName(mockMed[0]);
            item.setStrength(mockMed[1]);
            item.setDosage(mockMed[2]);
            item.setFrequency(mockMed[3]);
            item.setDuration(mockMed[4]);
            items.add(item);
        }
        prescriptionItemRepository.saveAll(items);

        publishPrescriptionNotification(patientId, saved.getId());
        return saved;
    }

    /**
     * Generates a digital e-prescription document (JPEG image) on an A4-proportioned canvas,
     * persists record metadata, and saves line items in batch.
     */
    @Transactional
    public MedicalRecord createDigitalPrescription(DigitalPrescriptionRequest request) {
        String filename = UUID.randomUUID() + "_prescription.jpg";

        // Look up human-readable doctor and patient names
        String doctorName = "Attending Physician";
        String doctorSpec = "General Medicine";
        if (request.getDoctorId() != null) {
            var docOpt = doctorRepository.findById(request.getDoctorId());
            if (docOpt.isPresent()) {
                var doc = docOpt.get();
                if (doc.getUser() != null && doc.getUser().getFullName() != null) {
                    doctorName = "Dr. " + doc.getUser().getFullName();
                }
                if (doc.getSpecialization() != null) {
                    doctorSpec = doc.getSpecialization();
                }
            } else {
                var userOpt = userRepository.findById(request.getDoctorId());
                if (userOpt.isPresent() && userOpt.get().getFullName() != null) {
                    doctorName = "Dr. " + userOpt.get().getFullName();
                }
            }
        }

        String patientName = "Patient";
        if (request.getPatientId() != null) {
            var userOpt = userRepository.findById(request.getPatientId());
            if (userOpt.isPresent() && userOpt.get().getFullName() != null) {
                patientName = userOpt.get().getFullName();
            }
        }

        try {
            BufferedImage image = new BufferedImage(800, 1050, BufferedImage.TYPE_INT_RGB);
            Graphics2D g2d = image.createGraphics();

            // Background canvas
            g2d.setColor(Color.WHITE);
            g2d.fillRect(0, 0, 800, 1050);

            // Antialiasing for clean typography
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            // Header Banner
            g2d.setColor(new Color(30, 41, 59)); // Slate-800
            g2d.fillRect(0, 0, 800, 95);

            g2d.setColor(Color.WHITE);
            g2d.setFont(new Font("Arial", Font.BOLD, 24));
            g2d.drawString("MEDIVRA DIGITAL HEALTHCARE", 40, 45);
            g2d.setFont(new Font("Arial", Font.PLAIN, 12));
            g2d.setColor(new Color(148, 163, 184));
            g2d.drawString("OFFICIAL ELECTRONIC MEDICAL PRESCRIPTION", 40, 70);

            g2d.setColor(Color.WHITE);
            g2d.setFont(new Font("Arial", Font.BOLD, 13));
            g2d.drawString("Date: " + LocalDate.now(), 640, 55);

            // Metadata Section
            g2d.setColor(new Color(248, 250, 252)); // Slate-50 background
            g2d.fillRoundRect(40, 115, 720, 100, 16, 16);
            g2d.setColor(new Color(226, 232, 240));
            g2d.drawRoundRect(40, 115, 720, 100, 16, 16);

            // Doctor details (left)
            g2d.setColor(new Color(15, 23, 42));
            g2d.setFont(new Font("Arial", Font.BOLD, 16));
            g2d.drawString(doctorName, 60, 145);
            g2d.setFont(new Font("Arial", Font.PLAIN, 13));
            g2d.setColor(new Color(71, 85, 105));
            g2d.drawString("Specialization: " + doctorSpec, 60, 170);
            g2d.drawString("Consultation ID: " + (request.getAppointmentId() != null ? request.getAppointmentId().toString().substring(0, 8) + "..." : "Walk-in"), 60, 195);

            // Patient details (right)
            g2d.setColor(new Color(15, 23, 42));
            g2d.setFont(new Font("Arial", Font.BOLD, 16));
            g2d.drawString("Patient: " + patientName, 440, 145);
            g2d.setFont(new Font("Arial", Font.PLAIN, 13));
            g2d.setColor(new Color(71, 85, 105));
            if (request.getDiagnosis() != null && !request.getDiagnosis().isBlank()) {
                g2d.drawString("Diagnosis: " + request.getDiagnosis(), 440, 170);
            } else {
                g2d.drawString("Status: Active Consultation", 440, 170);
            }
            if (request.getFollowUpDays() != null && request.getFollowUpDays() > 0) {
                g2d.drawString("Review: In " + request.getFollowUpDays() + " days", 440, 195);
            }

            // Medical Rx Symbol
            g2d.setColor(new Color(79, 70, 229)); // Indigo
            g2d.setFont(new Font("Arial", Font.BOLD | Font.ITALIC, 28));
            g2d.drawString("Rx (Prescription Details)", 40, 248);

            // Table Header
            g2d.setColor(new Color(241, 245, 249));
            g2d.fillRect(40, 265, 720, 32);

            g2d.setColor(new Color(30, 41, 59));
            g2d.setFont(new Font("Arial", Font.BOLD, 12));
            g2d.drawString("Medicine Name", 55, 286);
            g2d.drawString("Strength", 270, 286);
            g2d.drawString("Dosage", 380, 286);
            g2d.drawString("Frequency", 480, 286);
            g2d.drawString("Duration", 620, 286);

            int y = 325;
            g2d.setFont(new Font("Arial", Font.PLAIN, 13));

            if (request.getMedicines() != null && !request.getMedicines().isEmpty()) {
                for (PrescriptionMedicine med : request.getMedicines()) {
                    g2d.setColor(new Color(15, 23, 42));
                    g2d.drawString(med.getName(), 55, y);
                    g2d.drawString(med.getStrength() != null && !med.getStrength().isBlank() ? med.getStrength() : "—", 270, y);
                    g2d.drawString(med.getDosage() != null ? med.getDosage() : "1 dose", 380, y);
                    g2d.drawString(med.getFrequency() != null ? med.getFrequency() : "As directed", 480, y);
                    g2d.drawString(med.getDuration() != null ? med.getDuration() : "Ongoing", 620, y);

                    g2d.setColor(new Color(241, 245, 249));
                    g2d.drawLine(40, y + 12, 760, y + 12);
                    y += 36;
                }
            } else {
                g2d.setColor(Color.GRAY);
                g2d.drawString("No specific medications prescribed.", 55, y);
                y += 36;
            }

            // Prescribed Lab Tests (if any)
            if (request.getLabTests() != null && !request.getLabTests().isEmpty()) {
                y += 15;
                g2d.setColor(new Color(217, 119, 6)); // Amber
                g2d.setFont(new Font("Arial", Font.BOLD, 14));
                g2d.drawString("Prescribed Diagnostic Tests:", 40, y);
                y += 22;
                g2d.setFont(new Font("Arial", Font.PLAIN, 12));
                g2d.setColor(new Color(51, 65, 85));
                String testsJoined = String.join(" • ", request.getLabTests());
                g2d.drawString(testsJoined, 40, y);
                y += 15;
            }

            // Doctor instructions
            y += 20;
            g2d.setColor(new Color(79, 70, 229));
            g2d.setFont(new Font("Arial", Font.BOLD, 14));
            g2d.drawString("Doctor's Advice & Clinical Instructions:", 40, y);
            g2d.setFont(new Font("Arial", Font.PLAIN, 12));
            g2d.setColor(new Color(51, 65, 85));
            String advice = request.getNotes() != null && !request.getNotes().isBlank() ? request.getNotes() : "Follow medication schedule as prescribed. Contact physician in case of adverse reaction.";
            g2d.drawString(advice, 40, y + 22);

            // Footer Signature section
            g2d.setColor(new Color(148, 163, 184));
            g2d.drawLine(40, 950, 760, 950);
            g2d.setFont(new Font("Arial", Font.ITALIC, 11));
            g2d.drawString("Digitally authenticated and recorded via Medivra Health Journey Engine", 40, 975);
            g2d.setFont(new Font("Arial", Font.BOLD, 12));
            g2d.setColor(new Color(30, 41, 59));
            g2d.drawString(doctorName, 580, 975);
            g2d.drawLine(560, 960, 740, 960);

            g2d.dispose();

            // Persist rasterized JPEG artifact
            File outputDir = new File("uploads");
            if (!outputDir.exists()) {
                outputDir.mkdirs();
            }
            File outputFile = new File(outputDir, filename);
            ImageIO.write(image, "jpg", outputFile);

        } catch (Exception e) {
            log.error("Failed to render digital prescription: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to generate digital prescription image: " + e.getMessage(), e);
        }

        MedicalRecord record = new MedicalRecord();
        record.setAppointmentId(request.getAppointmentId());
        record.setDoctorId(request.getDoctorId());
        record.setPatientId(request.getPatientId());
        record.setNotes(request.getNotes());
        record.setFilePath(filename);
        record.setFileType("image/jpeg");

        MedicalRecord saved = recordRepository.save(record);

        // Batch save structured prescription items
        if (request.getMedicines() != null && !request.getMedicines().isEmpty()) {
            List<PrescriptionItem> items = new ArrayList<>();
            for (PrescriptionMedicine med : request.getMedicines()) {
                PrescriptionItem item = new PrescriptionItem();
                item.setMedicalRecordId(saved.getId());
                item.setMedicineName(med.getName());
                item.setStrength(med.getStrength());
                item.setDosage(med.getDosage());
                item.setFrequency(med.getFrequency());
                item.setDuration(med.getDuration());
                items.add(item);
            }
            prescriptionItemRepository.saveAll(items);
        }

        publishPrescriptionNotification(request.getPatientId(), saved.getId());
        
        try {
            treatmentPlanService.createPlanFromPrescription(saved, request);
        } catch (Exception e) {
            log.error("Failed to auto-create treatment plan from prescription: {}", e.getMessage(), e);
        }

        return saved;
    }

    /**
     * Uploads an external prescription document independent of an active appointment.
     */
    @Transactional
    public MedicalRecord uploadExternalPrescription(UUID patientId, String notes, MultipartFile file) {
        String filename = fileStorageService.save(file);

        MedicalRecord record = new MedicalRecord();
        record.setPatientId(patientId);
        record.setNotes(notes != null && !notes.isBlank() ? notes : "Uploaded external prescription");
        record.setFilePath(filename);
        record.setFileType(file.getContentType());

        MedicalRecord saved = recordRepository.save(record);

        String[][] mockMeds = {
                {"Paracetamol", "500mg", "1 tablet", "1-0-1", "5 days"},
                {"Cetirizine", "10mg", "1 tablet", "0-0-1", "7 days"},
                {"Ibuprofen", "400mg", "1 tablet", "1-0-1", "3 days"}
        };

        List<PrescriptionItem> items = new ArrayList<>();
        for (String[] mockMed : mockMeds) {
            PrescriptionItem item = new PrescriptionItem();
            item.setMedicalRecordId(saved.getId());
            item.setMedicineName(mockMed[0]);
            item.setStrength(mockMed[1]);
            item.setDosage(mockMed[2]);
            item.setFrequency(mockMed[3]);
            item.setDuration(mockMed[4]);
            items.add(item);
        }
        prescriptionItemRepository.saveAll(items);

        return saved;
    }

    @Transactional(readOnly = true)
    public List<PrescriptionItem> getPrescriptionItems(UUID recordId) {
        return prescriptionItemRepository.findByMedicalRecordId(recordId);
    }

    /**
     * Replaces previous extracted items with a user/doctor verified medicine list.
     */
    @Transactional
    public List<PrescriptionItem> verifyMedicines(UUID recordId, List<PrescriptionMedicine> verifiedList) {
        prescriptionItemRepository.deleteByMedicalRecordId(recordId);

        if (verifiedList == null || verifiedList.isEmpty()) {
            return List.of();
        }

        List<PrescriptionItem> itemsToSave = new ArrayList<>();
        for (PrescriptionMedicine med : verifiedList) {
            PrescriptionItem item = new PrescriptionItem();
            item.setMedicalRecordId(recordId);
            item.setMedicineName(med.getName());
            item.setStrength(med.getStrength());
            item.setDosage(med.getDosage());
            item.setFrequency(med.getFrequency());
            item.setDuration(med.getDuration());
            itemsToSave.add(item);
        }

        return prescriptionItemRepository.saveAll(itemsToSave);
    }

    @Transactional(readOnly = true)
    public List<MedicalRecord> getRecordsByPatient(UUID patientId) {
        return recordRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    @Transactional(readOnly = true)
    public List<MedicalRecord> getRecordsByDoctor(UUID doctorId) {
        return recordRepository.findByDoctorIdOrderByCreatedAtDesc(doctorId);
    }

    @Transactional(readOnly = true)
    public MedicalRecord getRecordByAppointment(UUID appointmentId) {
        return recordRepository.findByAppointmentId(appointmentId).orElse(null);
    }

    private void publishPrescriptionNotification(UUID patientId, UUID recordId) {
        try {
            eventPublisher.publishEvent(new NotificationEvent(
                    this,
                    patientId,
                    "Prescription Uploaded",
                    "A new prescription/record has been uploaded for your consultation.",
                    NotificationType.PRESCRIPTION_UPLOADED,
                    recordId.toString()
            ));
        } catch (Exception e) {
            log.warn("Failed to publish PrescriptionUploaded event for patient {}: {}", patientId, e.getMessage());
        }
    }
}
