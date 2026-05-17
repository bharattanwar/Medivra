package com.app.doctor.service;

import com.app.doctor.dto.AvailabilityDTO;
import com.app.doctor.entity.Doctor;
import com.app.doctor.entity.DoctorAvailability;
import com.app.doctor.repository.AvailabilityRepository;
import com.app.doctor.repository.DoctorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AvailabilityService {

    private final AvailabilityRepository availabilityRepository;
    private final DoctorRepository doctorRepository;

    public AvailabilityService(AvailabilityRepository availabilityRepository, DoctorRepository doctorRepository) {
        this.availabilityRepository = availabilityRepository;
        this.doctorRepository = doctorRepository;
    }

    @Transactional
    public void saveAvailability(UUID userId, List<AvailabilityDTO> availabilityDTOs) {
        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Doctor not found for user: " + userId));

        // For simplicity, we replace all existing availability
        availabilityRepository.deleteByDoctorId(doctor.getId());

        List<DoctorAvailability> availabilities = availabilityDTOs.stream().map(dto -> {
            DoctorAvailability availability = new DoctorAvailability();
            availability.setDoctorId(doctor.getId());
            availability.setDayOfWeek(dto.getDayOfWeek());
            availability.setStartTime(dto.getStartTime());
            availability.setEndTime(dto.getEndTime());
            return availability;
        }).collect(Collectors.toList());

        availabilityRepository.saveAll(availabilities);
    }

    public List<AvailabilityDTO> getAvailabilityByDoctorId(UUID doctorId) {
        return availabilityRepository.findByDoctorId(doctorId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }
    
    public List<AvailabilityDTO> getAvailabilityByUserId(UUID userId) {
        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Doctor not found for user: " + userId));
        return getAvailabilityByDoctorId(doctor.getId());
    }

    private AvailabilityDTO mapToDTO(DoctorAvailability availability) {
        AvailabilityDTO dto = new AvailabilityDTO();
        dto.setId(availability.getId());
        dto.setDayOfWeek(availability.getDayOfWeek());
        dto.setStartTime(availability.getStartTime());
        dto.setEndTime(availability.getEndTime());
        return dto;
    }
}
