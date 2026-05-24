package com.app.doctor.service;

import com.app.auth.util.JwtUtil;
import com.app.doctor.dto.DoctorDTO;
import com.app.doctor.dto.DoctorRegisterRequest;
import com.app.doctor.entity.Doctor;
import com.app.doctor.repository.DoctorRepository;
import com.app.user.dto.AuthResponse;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DoctorService {

    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public DoctorService(DoctorRepository doctorRepository, UserRepository userRepository,
                         PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public AuthResponse registerDoctor(DoctorRegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }

        // Create user record with DOCTOR role
        User user = new User();
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole("DOCTOR");

        User savedUser = userRepository.save(user);

        // Create doctor profile linked to the user
        System.out.println("Doctor Registration - Request Data:");
        System.out.println("Email: " + request.getEmail());
        System.out.println("Hospital: " + request.getHospitalName());
        System.out.println("City: " + request.getCity());
        System.out.println("Image URL: " + request.getProfileImageUrl());

        Doctor doctor = new Doctor();
        doctor.setUserId(savedUser.getId());
        doctor.setEmail(savedUser.getEmail());
        doctor.setSpecialization(request.getSpecialization());
        doctor.setLicenseNumber(request.getLicenseNumber());
        doctor.setExperienceYears(request.getExperienceYears());
        doctor.setConsultationFee(request.getConsultationFee());
        doctor.setHospitalName(request.getHospitalName());
        doctor.setCity(request.getCity());
        doctor.setProfileImageUrl(request.getProfileImageUrl());
        
        System.out.println("Doctor Entity mapped: Hospital=" + doctor.getHospitalName() + ", City=" + doctor.getCity());

        // Set defaults for new fields
        doctor.setRating(0.0);
        doctor.setAvailable(true);
        doctor.setApproved(false);

        doctorRepository.save(doctor);

        String token = jwtUtil.generateToken(savedUser.getEmail());

        return new AuthResponse(
                token,
                savedUser.getEmail(),
                savedUser.getFullName(),
                savedUser.getRole(),
                savedUser.getId()
        );
    }

    public List<DoctorDTO> getAllDoctors() {
        return doctorRepository.findAll().stream()
                .filter(d -> Boolean.TRUE.equals(d.isApproved()))
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public List<DoctorDTO> searchDoctors(String specialization, String city, String name) {
        System.out.println("Searching Doctors with filters - Specialization: [" + specialization + "], City: [" + city + "], Name: [" + name + "]");
        List<Doctor> results = doctorRepository.searchDoctors(specialization, city, name);
        System.out.println("Found " + results.size() + " doctors matching criteria");
        return results.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public DoctorDTO getDoctorById(UUID id) {
        Doctor doctor = doctorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Doctor not found"));
        return convertToDTO(doctor);
    }

    private DoctorDTO convertToDTO(Doctor doctor) {
        User user = userRepository.findById(doctor.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found for doctor"));

        return new DoctorDTO(
                doctor.getId(),
                user.getFullName(),
                doctor.getEmail(),
                doctor.getSpecialization(),
                doctor.getExperienceYears(),
                doctor.getConsultationFee(),
                doctor.getHospitalName(),
                doctor.getCity(),
                doctor.getRating(),
                doctor.getProfileImageUrl(),
                doctor.getAvailable()
        );
    }
}
