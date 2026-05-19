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

@Service
public class MedicalRecordService {

    private final RecordRepository recordRepository;
    private final FileStorageService fileStorageService;
    private final ApplicationEventPublisher eventPublisher;

    public MedicalRecordService(RecordRepository recordRepository, FileStorageService fileStorageService, ApplicationEventPublisher eventPublisher) {
        this.recordRepository = recordRepository;
        this.fileStorageService = fileStorageService;
        this.eventPublisher = eventPublisher;
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

    public List<MedicalRecord> getRecordsByPatient(UUID patientId) {
        return recordRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    public MedicalRecord getRecordByAppointment(UUID appointmentId) {
        return recordRepository.findByAppointmentId(appointmentId).orElse(null);
    }
}
