package com.app.doctor.controller;

import com.app.common.dto.ApiResponse;
import com.app.doctor.entity.Doctor;
import com.app.doctor.entity.DoctorMedicine;
import com.app.doctor.repository.DoctorRepository;
import com.app.doctor.repository.DoctorMedicineRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/doctors/medicines")
public class DoctorMedicineController {

    private final DoctorMedicineRepository doctorMedicineRepository;
    private final DoctorRepository doctorRepository;

    public DoctorMedicineController(DoctorMedicineRepository doctorMedicineRepository, DoctorRepository doctorRepository) {
        this.doctorMedicineRepository = doctorMedicineRepository;
        this.doctorRepository = doctorRepository;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DoctorMedicine>> addMedicine(
            @RequestParam UUID userId,
            @RequestBody DoctorMedicine medicineRequest) {
        
        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Doctor profile not found for user ID: " + userId));

        DoctorMedicine medicine = new DoctorMedicine(
                doctor.getId(),
                medicineRequest.getName().trim(),
                medicineRequest.getStrength() != null ? medicineRequest.getStrength().trim() : null
        );

        DoctorMedicine saved = doctorMedicineRepository.save(medicine);
        return ResponseEntity.ok(ApiResponse.success(saved, "Medicine added to your specific list successfully"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<DoctorMedicine>>> getMedicines(@RequestParam UUID userId) {
        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Doctor profile not found for user ID: " + userId));

        List<DoctorMedicine> list = doctorMedicineRepository.findByDoctorIdOrderByNameAsc(doctor.getId());
        return ResponseEntity.ok(ApiResponse.success(list, "Doctor specific medicines retrieved"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteMedicine(@PathVariable UUID id) {
        doctorMedicineRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Medicine deleted from your list"));
    }
}
