package com.app.pharmacy.controller;

import com.app.common.dto.ApiResponse;
import com.app.pharmacy.dto.MedicineResponse;
import com.app.pharmacy.entity.Medicine;
import com.app.pharmacy.repository.MedicineRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/medicines")
public class MedicineController {

    private final MedicineRepository medicineRepository;

    public MedicineController(MedicineRepository medicineRepository) {
        this.medicineRepository = medicineRepository;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<MedicineResponse>>> getAllMedicines() {
        List<MedicineResponse> medicines = medicineRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(medicines, "Medicines retrieved successfully"));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<MedicineResponse>>> searchMedicines(
            @RequestParam(name = "q") String query) {
        List<MedicineResponse> medicines = medicineRepository
            .findByNameContainingIgnoreCase(query)
            .stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(medicines, "Search results retrieved"));
    }

    @PostMapping("/resolve")
    public ResponseEntity<ApiResponse<List<MedicineResponse>>> resolveMedicines(
            @RequestBody List<ResolveItem> items) {
        List<MedicineResponse> resolved = items.stream().map(item -> {
            if (item.getName() == null || item.getName().isBlank()) {
                throw new RuntimeException("Medicine name is required");
            }
            List<Medicine> existingList = medicineRepository.findByNameContainingIgnoreCase(item.getName());
            java.util.Optional<Medicine> exactMatch = existingList.stream()
                    .filter(m -> m.getName().equalsIgnoreCase(item.getName().trim()))
                    .findFirst();

            Medicine medicine;
            if (exactMatch.isPresent()) {
                medicine = exactMatch.get();
            } else {
                medicine = new Medicine();
                medicine.setName(item.getName().trim());
                medicine.setStrength(item.getStrength());
                medicine.setManufacturer("Generic");
                medicine = medicineRepository.save(medicine);
            }
            return toResponse(medicine);
        }).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(resolved, "Medicines resolved successfully"));
    }

    public static class ResolveItem {
        private String name;
        private String strength;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getStrength() { return strength; }
        public void setStrength(String strength) { this.strength = strength; }
    }

    private MedicineResponse toResponse(Medicine medicine) {
        return new MedicineResponse(
                medicine.getId(),
                medicine.getName(),
                medicine.getManufacturer(),
                medicine.getStrength()
        );
    }
}
