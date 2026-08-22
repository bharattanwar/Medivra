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

    public MedicalRecordService(RecordRepository recordRepository,
                                FileStorageService fileStorageService,
                                ApplicationEventPublisher eventPublisher,
                                PrescriptionItemRepository prescriptionItemRepository) {
        this.recordRepository = recordRepository;
        this.fileStorageService = fileStorageService;
        this.eventPublisher = eventPublisher;
        this.prescriptionItemRepository = prescriptionItemRepository;
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

        try {
            BufferedImage image = new BufferedImage(800, 1000, BufferedImage.TYPE_INT_RGB);
            Graphics2D g2d = image.createGraphics();

            // Background canvas
            g2d.setColor(Color.WHITE);
            g2d.fillRect(0, 0, 800, 1000);

            // Antialiasing for clean typography
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            // Header Banner
            g2d.setColor(new Color(30, 41, 59)); // Slate-800
            g2d.fillRect(0, 0, 800, 100);

            g2d.setColor(Color.WHITE);
            g2d.setFont(new Font("Arial", Font.BOLD, 26));
            g2d.drawString("MEDIVRA E-PRESCRIPTION", 40, 60);

            // Metadata Section
            g2d.setColor(Color.BLACK);
            g2d.setFont(new Font("Arial", Font.PLAIN, 14));
            g2d.drawString("Date: " + LocalDate.now(), 620, 140);

            g2d.setFont(new Font("Arial", Font.BOLD, 16));
            g2d.drawString("Doctor Details", 40, 140);
            g2d.setFont(new Font("Arial", Font.PLAIN, 14));
            g2d.drawString("ID: " + request.getDoctorId(), 40, 165);

            g2d.setFont(new Font("Arial", Font.BOLD, 16));
            g2d.drawString("Patient Details", 40, 210);
            g2d.setFont(new Font("Arial", Font.PLAIN, 14));
            g2d.drawString("ID: " + request.getPatientId(), 40, 235);

            // Divider Rule
            g2d.setColor(new Color(226, 232, 240));
            g2d.setStroke(new BasicStroke(2));
            g2d.drawLine(40, 260, 760, 260);

            // Medical Rx Symbol
            g2d.setColor(new Color(79, 70, 229)); // Indigo
            g2d.setFont(new Font("Arial", Font.BOLD | Font.ITALIC, 32));
            g2d.drawString("Rx", 40, 310);

            // Table Header
            g2d.setColor(new Color(241, 245, 249));
            g2d.fillRect(40, 340, 720, 35);

            g2d.setColor(Color.BLACK);
            g2d.setFont(new Font("Arial", Font.BOLD, 13));
            g2d.drawString("Medicine Name", 50, 362);
            g2d.drawString("Strength", 280, 362);
            g2d.drawString("Dosage", 400, 362);
            g2d.drawString("Frequency", 500, 362);
            g2d.drawString("Duration", 650, 362);

            int y = 410;
            g2d.setFont(new Font("Arial", Font.PLAIN, 13));

            if (request.getMedicines() != null) {
                for (PrescriptionMedicine med : request.getMedicines()) {
                    g2d.drawString(med.getName(), 50, y);
                    g2d.drawString(med.getStrength() != null ? med.getStrength() : "-", 280, y);
                    g2d.drawString(med.getDosage() != null ? med.getDosage() : "-", 400, y);
                    g2d.drawString(med.getFrequency() != null ? med.getFrequency() : "-", 500, y);
                    g2d.drawString(med.getDuration() != null ? med.getDuration() : "-", 650, y);

                    g2d.setColor(new Color(241, 245, 249));
                    g2d.drawLine(40, y + 15, 760, y + 15);
                    g2d.setColor(Color.BLACK);
                    y += 40;
                }
            }

            // Doctor instructions
            y += 20;
            g2d.setFont(new Font("Arial", Font.BOLD, 15));
            g2d.drawString("Instructions / Notes:", 40, y);
            g2d.setFont(new Font("Arial", Font.PLAIN, 13));
            g2d.drawString(request.getNotes() != null ? request.getNotes() : "No custom notes", 40, y + 25);

            // Footer Signature section
            g2d.setFont(new Font("Arial", Font.ITALIC, 14));
            g2d.drawString("Generated Digitally via Medivra", 40, 920);
            g2d.drawString("Authorized Signature", 600, 920);
            g2d.drawLine(580, 900, 740, 900);

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
