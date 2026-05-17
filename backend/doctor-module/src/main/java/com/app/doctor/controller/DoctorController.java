package com.app.doctor.controller;

import com.app.common.dto.ApiResponse;
import com.app.doctor.dto.DoctorDTO;
import com.app.doctor.dto.DoctorRegisterRequest;
import com.app.doctor.service.DoctorService;
import com.app.user.dto.AuthResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/doctors")
public class DoctorController {

    private final DoctorService doctorService;

    public DoctorController(DoctorService doctorService) {
        this.doctorService = doctorService;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> registerDoctor(@Valid @RequestBody DoctorRegisterRequest request) {
        AuthResponse response = doctorService.registerDoctor(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Doctor registration successful"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<DoctorDTO>>> getAllDoctors() {
        List<DoctorDTO> doctors = doctorService.getAllDoctors();
        return ResponseEntity.ok(ApiResponse.success(doctors, "Doctors retrieved successfully"));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<DoctorDTO>>> searchDoctors(
            @RequestParam(required = false) String specialization,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String name) {
        System.out.println("Controller received search request - spec: " + specialization + ", city: " + city + ", name: " + name);
        List<DoctorDTO> doctors = doctorService.searchDoctors(specialization, city, name);
        return ResponseEntity.ok(ApiResponse.success(doctors, "Doctors search results retrieved"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DoctorDTO>> getDoctorById(@PathVariable UUID id) {
        DoctorDTO doctor = doctorService.getDoctorById(id);
        return ResponseEntity.ok(ApiResponse.success(doctor, "Doctor retrieved successfully"));
    }
}
