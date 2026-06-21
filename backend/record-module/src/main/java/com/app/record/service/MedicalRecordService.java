package com.app.record.service;

import com.app.record.entity.MedicalRecord;
import com.app.record.repository.RecordRepository;
import com.app.common.event.NotificationEvent;
import com.app.common.entity.NotificationType;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

import org.springframework.transaction.annotation.Transactional;
import java.io.File;
import javax.imageio.ImageIO;

@Service
public class MedicalRecordService {

    private final RecordRepository recordRepository;
    private final FileStorageService fileStorageService;
    private final ApplicationEventPublisher eventPublisher;
    private final com.app.record.repository.PrescriptionItemRepository prescriptionItemRepository;

    public MedicalRecordService(RecordRepository recordRepository, FileStorageService fileStorageService, ApplicationEventPublisher eventPublisher, com.app.record.repository.PrescriptionItemRepository prescriptionItemRepository) {
        this.recordRepository = recordRepository;
        this.fileStorageService = fileStorageService;
        this.eventPublisher = eventPublisher;
        this.prescriptionItemRepository = prescriptionItemRepository;
    }

    public MedicalRecord uploadPrescription(UUID appointmentId, UUID doctorId, UUID patientId, String notes, MultipartFile file) {
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
        
        for (String[] mockMed : mockMeds) {
            com.app.record.entity.PrescriptionItem item = new com.app.record.entity.PrescriptionItem();
            item.setMedicalRecordId(saved.getId());
            item.setMedicineName(mockMed[0]);
            item.setStrength(mockMed[1]);
            item.setDosage(mockMed[2]);
            item.setFrequency(mockMed[3]);
            item.setDuration(mockMed[4]);
            prescriptionItemRepository.save(item);
        }

        // Publish event to notify the Patient
        try {
            eventPublisher.publishEvent(new NotificationEvent(
                this,
                patientId,
                "Prescription Uploaded",
                "A new prescription/record has been uploaded for your consultation.",
                NotificationType.PRESCRIPTION_UPLOADED,
                saved.getId().toString()
            ));
        } catch (Exception e) {
            System.err.println("Failed to publish PrescriptionUploaded event: " + e.getMessage());
        }

        return saved;
    }

    @Transactional
    public MedicalRecord createDigitalPrescription(com.app.record.dto.DigitalPrescriptionRequest request) {
        String filename = UUID.randomUUID().toString() + "_prescription.jpg";
        
        try {
            java.awt.image.BufferedImage image = new java.awt.image.BufferedImage(800, 1000, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g2d = image.createGraphics();
            
            // Fill background
            g2d.setColor(java.awt.Color.WHITE);
            g2d.fillRect(0, 0, 800, 1000);
            
            // Anti-aliasing
            g2d.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.setRenderingHint(java.awt.RenderingHints.KEY_TEXT_ANTIALIASING, java.awt.RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            
            // Top Header banner (Dark Indigo/Blue)
            g2d.setColor(new java.awt.Color(30, 41, 59)); // slate-800
            g2d.fillRect(0, 0, 800, 100);
            
            g2d.setColor(java.awt.Color.WHITE);
            g2d.setFont(new java.awt.Font("Arial", java.awt.Font.BOLD, 26));
            g2d.drawString("MEDIVRA E-PRESCRIPTION", 40, 60);
            
            // Prescription Details
            g2d.setColor(java.awt.Color.BLACK);
            g2d.setFont(new java.awt.Font("Arial", java.awt.Font.PLAIN, 14));
            g2d.drawString("Date: " + java.time.LocalDate.now().toString(), 620, 140);
            
            g2d.setFont(new java.awt.Font("Arial", java.awt.Font.BOLD, 16));
            g2d.drawString("Doctor Details", 40, 140);
            g2d.setFont(new java.awt.Font("Arial", java.awt.Font.PLAIN, 14));
            g2d.drawString("ID: " + request.getDoctorId(), 40, 165);
            
            g2d.setFont(new java.awt.Font("Arial", java.awt.Font.BOLD, 16));
            g2d.drawString("Patient Details", 40, 210);
            g2d.setFont(new java.awt.Font("Arial", java.awt.Font.PLAIN, 14));
            g2d.drawString("ID: " + request.getPatientId(), 40, 235);
            
            // Divider
            g2d.setColor(new java.awt.Color(226, 232, 240));
            g2d.setStroke(new java.awt.BasicStroke(2));
            g2d.drawLine(40, 260, 760, 260);
            
            // Rx Symbol
            g2d.setColor(new java.awt.Color(79, 70, 229)); // Indigo
            g2d.setFont(new java.awt.Font("Arial", java.awt.Font.BOLD | java.awt.Font.ITALIC, 32));
            g2d.drawString("Rx", 40, 310);
            
            // Medicines Table Header
            g2d.setColor(new java.awt.Color(241, 245, 249));
            g2d.fillRect(40, 340, 720, 35);
            
            g2d.setColor(java.awt.Color.BLACK);
            g2d.setFont(new java.awt.Font("Arial", java.awt.Font.BOLD, 13));
            g2d.drawString("Medicine Name", 50, 362);
            g2d.drawString("Strength", 280, 362);
            g2d.drawString("Dosage", 400, 362);
            g2d.drawString("Frequency", 500, 362);
            g2d.drawString("Duration", 650, 362);
            
            int y = 410;
            g2d.setFont(new java.awt.Font("Arial", java.awt.Font.PLAIN, 13));
            
            if (request.getMedicines() != null) {
                for (com.app.record.dto.PrescriptionMedicine med : request.getMedicines()) {
                    g2d.drawString(med.getName(), 50, y);
                    g2d.drawString(med.getStrength() != null ? med.getStrength() : "-", 280, y);
                    g2d.drawString(med.getDosage() != null ? med.getDosage() : "-", 400, y);
                    g2d.drawString(med.getFrequency() != null ? med.getFrequency() : "-", 500, y);
                    g2d.drawString(med.getDuration() != null ? med.getDuration() : "-", 650, y);
                    
                    g2d.setColor(new java.awt.Color(241, 245, 249));
                    g2d.drawLine(40, y + 15, 760, y + 15);
                    g2d.setColor(java.awt.Color.BLACK);
                    y += 40;
                }
            }
            
            // Instructions
            y += 20;
            g2d.setFont(new java.awt.Font("Arial", java.awt.Font.BOLD, 15));
            g2d.drawString("Instructions / Notes:", 40, y);
            g2d.setFont(new java.awt.Font("Arial", java.awt.Font.PLAIN, 13));
            g2d.drawString(request.getNotes() != null ? request.getNotes() : "No custom notes", 40, y + 25);
            
            // Footer signature
            g2d.setFont(new java.awt.Font("Arial", java.awt.Font.ITALIC, 14));
            g2d.drawString("Generated Digitally via Medivra", 40, 920);
            g2d.drawString("Authorized Signature", 600, 920);
            g2d.drawLine(580, 900, 740, 900);
            
            g2d.dispose();

            // Save image to file storage path
            File outputfile = new File("uploads/" + filename);
            ImageIO.write(image, "jpg", outputfile);

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate digital prescription image: " + e.getMessage());
        }

        MedicalRecord record = new MedicalRecord();
        record.setAppointmentId(request.getAppointmentId());
        record.setDoctorId(request.getDoctorId());
        record.setPatientId(request.getPatientId());
        record.setNotes(request.getNotes());
        record.setFilePath(filename);
        record.setFileType("image/jpeg");
        
        MedicalRecord saved = recordRepository.save(record);

        if (request.getMedicines() != null) {
            for (com.app.record.dto.PrescriptionMedicine med : request.getMedicines()) {
                com.app.record.entity.PrescriptionItem item = new com.app.record.entity.PrescriptionItem();
                item.setMedicalRecordId(saved.getId());
                item.setMedicineName(med.getName());
                item.setStrength(med.getStrength());
                item.setDosage(med.getDosage());
                item.setFrequency(med.getFrequency());
                item.setDuration(med.getDuration());
                prescriptionItemRepository.save(item);
            }
        }

        // Publish event to notify the Patient
        try {
            eventPublisher.publishEvent(new NotificationEvent(
                this,
                request.getPatientId(),
                "Prescription Uploaded",
                "A new prescription/record has been uploaded for your consultation.",
                NotificationType.PRESCRIPTION_UPLOADED,
                saved.getId().toString()
            ));
        } catch (Exception e) {
            System.err.println("Failed to publish PrescriptionUploaded event: " + e.getMessage());
        }

        return saved;
    }

    @Transactional
    public MedicalRecord uploadExternalPrescription(UUID patientId, String notes, MultipartFile file) {
        String filename = fileStorageService.save(file);
        
        MedicalRecord record = new MedicalRecord();
        record.setPatientId(patientId);
        record.setNotes(notes != null && !notes.isBlank() ? notes : "Uploaded external prescription");
        record.setFilePath(filename);
        record.setFileType(file.getContentType());
        
        MedicalRecord saved = recordRepository.save(record);

        // Simulated AI/OCR extraction
        // We add some standard medicines to simulate scanning the document
        String[][] mockMeds = {
            {"Paracetamol", "500mg", "1 tablet", "1-0-1", "5 days"},
            {"Cetirizine", "10mg", "1 tablet", "0-0-1", "7 days"},
            {"Ibuprofen", "400mg", "1 tablet", "1-0-1", "3 days"}
        };
        
        for (String[] mockMed : mockMeds) {
            com.app.record.entity.PrescriptionItem item = new com.app.record.entity.PrescriptionItem();
            item.setMedicalRecordId(saved.getId());
            item.setMedicineName(mockMed[0]);
            item.setStrength(mockMed[1]);
            item.setDosage(mockMed[2]);
            item.setFrequency(mockMed[3]);
            item.setDuration(mockMed[4]);
            prescriptionItemRepository.save(item);
        }
        
        return saved;
    }

    @Transactional
    public List<com.app.record.entity.PrescriptionItem> getPrescriptionItems(UUID recordId) {
        return prescriptionItemRepository.findByMedicalRecordId(recordId);
    }

    @Transactional
    public List<com.app.record.entity.PrescriptionItem> verifyMedicines(UUID recordId, List<com.app.record.dto.PrescriptionMedicine> verifiedList) {
        prescriptionItemRepository.deleteByMedicalRecordId(recordId);
        
        List<com.app.record.entity.PrescriptionItem> savedItems = new java.util.ArrayList<>();
        if (verifiedList != null) {
            for (com.app.record.dto.PrescriptionMedicine med : verifiedList) {
                com.app.record.entity.PrescriptionItem item = new com.app.record.entity.PrescriptionItem();
                item.setMedicalRecordId(recordId);
                item.setMedicineName(med.getName());
                item.setStrength(med.getStrength());
                item.setDosage(med.getDosage());
                item.setFrequency(med.getFrequency());
                item.setDuration(med.getDuration());
                savedItems.add(prescriptionItemRepository.save(item));
            }
        }
        return savedItems;
    }

    public List<MedicalRecord> getRecordsByPatient(UUID patientId) {
        return recordRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    public MedicalRecord getRecordByAppointment(UUID appointmentId) {
        return recordRepository.findByAppointmentId(appointmentId).orElse(null);
    }
}
