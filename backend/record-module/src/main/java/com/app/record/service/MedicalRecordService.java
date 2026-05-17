package com.app.record.service;

import com.app.record.entity.MedicalRecord;
import com.app.record.repository.RecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@Service
public class MedicalRecordService {

    private final RecordRepository recordRepository;
    private final FileStorageService fileStorageService;

    public MedicalRecordService(RecordRepository recordRepository, FileStorageService fileStorageService) {
        this.recordRepository = recordRepository;
        this.fileStorageService = fileStorageService;
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
        
        return recordRepository.save(record);
    }

    public List<MedicalRecord> getRecordsByPatient(UUID patientId) {
        return recordRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    public MedicalRecord getRecordByAppointment(UUID appointmentId) {
        return recordRepository.findByAppointmentId(appointmentId).orElse(null);
    }
}
