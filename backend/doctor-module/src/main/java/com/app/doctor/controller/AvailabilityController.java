package com.app.doctor.controller;

import com.app.doctor.dto.AvailabilityDTO;
import com.app.doctor.service.AvailabilityService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/doctors")
public class AvailabilityController {

    private final AvailabilityService availabilityService;

    public AvailabilityController(AvailabilityService availabilityService) {
        this.availabilityService = availabilityService;
    }

    @PostMapping("/availability")
    public ResponseEntity<String> saveAvailability(@RequestParam UUID userId, @RequestBody List<AvailabilityDTO> availability) {
        availabilityService.saveAvailability(userId, availability);
        return ResponseEntity.ok("Availability saved successfully");
    }

    @GetMapping("/{id}/availability")
    public ResponseEntity<List<AvailabilityDTO>> getAvailability(@PathVariable UUID id) {
        return ResponseEntity.ok(availabilityService.getAvailabilityByDoctorId(id));
    }
    
    @GetMapping("/availability")
    public ResponseEntity<List<AvailabilityDTO>> getMyAvailability(@RequestParam UUID userId) {
        return ResponseEntity.ok(availabilityService.getAvailabilityByUserId(userId));
    }
}
