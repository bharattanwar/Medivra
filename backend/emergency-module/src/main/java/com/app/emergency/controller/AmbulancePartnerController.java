package com.app.emergency.controller;

import com.app.common.dto.ApiResponse;
import com.app.emergency.dto.*;
import com.app.emergency.entity.*;
import com.app.emergency.repository.*;
import com.app.emergency.service.AmbulanceDispatchService;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/ambulance")
public class AmbulancePartnerController {

    private final AmbulanceRepository ambulanceRepository;
    private final AmbulanceDriverRepository driverRepository;
    private final UserRepository userRepository;
    private final AmbulanceDispatchService dispatchService;
    private final EmergencyRequestRepository emergencyRequestRepository;

    public AmbulancePartnerController(
            AmbulanceRepository ambulanceRepository,
            AmbulanceDriverRepository driverRepository,
            UserRepository userRepository,
            AmbulanceDispatchService dispatchService,
            EmergencyRequestRepository emergencyRequestRepository) {
        this.ambulanceRepository = ambulanceRepository;
        this.driverRepository = driverRepository;
        this.userRepository = userRepository;
        this.dispatchService = dispatchService;
        this.emergencyRequestRepository = emergencyRequestRepository;
    }

    /** Register a new ambulance for the authenticated driver */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<Ambulance>> registerAmbulance(
            @Valid @RequestBody AmbulanceRegisterRequest request,
            Authentication authentication) {
        UUID driverId = resolveDriverId(authentication);

        Ambulance ambulance = new Ambulance();
        ambulance.setVehicleNumber(request.getVehicleNumber());
        ambulance.setAmbulanceType(request.getAmbulanceType());
        ambulance.setDriverId(driverId);
        ambulance.setEquipmentNotes(request.getEquipmentNotes());
        ambulance = ambulanceRepository.save(ambulance);

        return ResponseEntity.ok(ApiResponse.success(ambulance, "Ambulance registered successfully"));
    }

    /** Driver goes online */
    @PutMapping("/{ambulanceId}/online")
    public ResponseEntity<ApiResponse<Void>> goOnline(
            @PathVariable UUID ambulanceId,
            Authentication authentication) {
        Ambulance ambulance = ambulanceRepository.findById(ambulanceId)
                .orElseThrow(() -> new RuntimeException("Ambulance not found"));
        ambulance.setIsOnline(true);
        ambulance.setIsAvailable(true);
        ambulanceRepository.save(ambulance);
        return ResponseEntity.ok(ApiResponse.success(null, "You are now online"));
    }

    /** Driver goes offline */
    @PutMapping("/{ambulanceId}/offline")
    public ResponseEntity<ApiResponse<Void>> goOffline(
            @PathVariable UUID ambulanceId,
            Authentication authentication) {
        Ambulance ambulance = ambulanceRepository.findById(ambulanceId)
                .orElseThrow(() -> new RuntimeException("Ambulance not found"));
        ambulance.setIsOnline(false);
        ambulanceRepository.save(ambulance);
        return ResponseEntity.ok(ApiResponse.success(null, "You are now offline"));
    }

    /** Driver pushes their current GPS coordinates */
    @PostMapping("/{ambulanceId}/location")
    public ResponseEntity<ApiResponse<Void>> pushLocation(
            @PathVariable UUID ambulanceId,
            @RequestBody LocationPayload payload,
            Authentication authentication) {
        dispatchService.updateAmbulanceLocation(ambulanceId, payload.getLat(), payload.getLng());
        return ResponseEntity.ok(ApiResponse.success(null, "Location updated"));
    }

    /** Driver accepts an emergency dispatch */
    @PutMapping("/emergency/{emergencyId}/accept")
    public ResponseEntity<ApiResponse<EmergencyResponse>> acceptEmergency(
            @PathVariable UUID emergencyId,
            @RequestBody AmbulanceIdPayload payload,
            Authentication authentication) {
        EmergencyRequest assigned = dispatchService.acceptEmergency(emergencyId, payload.getAmbulanceId());
        EmergencyResponse response = toResponse(assigned);
        return ResponseEntity.ok(ApiResponse.success(response, "Emergency accepted. En route to patient."));
    }

    /** Driver rejects an emergency (another driver can still accept) */
    @PutMapping("/emergency/{emergencyId}/reject")
    public ResponseEntity<ApiResponse<Void>> rejectEmergency(
            @PathVariable UUID emergencyId,
            Authentication authentication) {
        // Simply log the rejection; the request stays open for other drivers
        return ResponseEntity.ok(ApiResponse.success(null, "Emergency request rejected"));
    }

    /** Driver updates trip status (EN_ROUTE → ARRIVED_AT_PATIENT → TRANSPORTING → ARRIVED_AT_HOSPITAL → COMPLETED) */
    @PutMapping("/emergency/{emergencyId}/status")
    public ResponseEntity<ApiResponse<EmergencyResponse>> updateStatus(
            @PathVariable UUID emergencyId,
            @Valid @RequestBody AmbulanceStatusUpdateRequest request,
            Authentication authentication) {
        EmergencyRequest updated = dispatchService.updateTripStatus(
                emergencyId, request.getEmergencyId() != null ? request.getEmergencyId() : emergencyId,
                request.getNewStatus(), request.getNotes());
        return ResponseEntity.ok(ApiResponse.success(toResponse(updated), "Status updated"));
    }

    /** Driver gets their currently active emergency */
    @GetMapping("/emergency/active")
    public ResponseEntity<ApiResponse<EmergencyResponse>> getActiveEmergency(Authentication authentication) {
        UUID driverId = resolveDriverId(authentication);
        return ambulanceRepository.findByDriverId(driverId)
                .flatMap(amb -> emergencyRequestRepository
                        .findByStatusInOrderByCreatedAtAsc(java.util.List.of(
                                EmergencyStatus.AMBULANCE_ASSIGNED,
                                EmergencyStatus.EN_ROUTE,
                                EmergencyStatus.ARRIVED_AT_PATIENT,
                                EmergencyStatus.TRANSPORTING))
                        .stream()
                        .filter(e -> amb.getId().equals(e.getAssignedAmbulanceId()))
                        .findFirst())
                .map(e -> ResponseEntity.ok(ApiResponse.success(toResponse(e), "Active emergency retrieved")))
                .orElse(ResponseEntity.ok(ApiResponse.success(null, "No active emergency")));
    }

    // ---- Inner helpers ----

    private UUID resolveDriverId(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return driverRepository.findByUserId(user.getId())
                .map(AmbulanceDriver::getId)
                .orElse(user.getId()); // fallback to userId for driver accounts
    }

    private EmergencyResponse toResponse(EmergencyRequest e) {
        EmergencyResponse r = new EmergencyResponse();
        r.setId(e.getId());
        r.setPatientId(e.getPatientId());
        r.setPatientLat(e.getPatientLat());
        r.setPatientLng(e.getPatientLng());
        r.setPatientAddress(e.getPatientAddress());
        r.setEmergencyType(e.getEmergencyType());
        r.setStatus(e.getStatus());
        r.setEstimatedArrivalMinutes(e.getEstimatedArrivalMinutes());
        r.setAssignedAmbulanceId(e.getAssignedAmbulanceId());
        r.setCreatedAt(e.getCreatedAt());
        return r;
    }

    // Simple request body helpers
    public static class LocationPayload {
        private double lat;
        private double lng;
        public double getLat() { return lat; }
        public void setLat(double lat) { this.lat = lat; }
        public double getLng() { return lng; }
        public void setLng(double lng) { this.lng = lng; }
    }

    public static class AmbulanceIdPayload {
        private UUID ambulanceId;
        public UUID getAmbulanceId() { return ambulanceId; }
        public void setAmbulanceId(UUID ambulanceId) { this.ambulanceId = ambulanceId; }
    }
}
