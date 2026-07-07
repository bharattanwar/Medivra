package com.app.emergency.controller;

import com.app.common.dto.ApiResponse;
import com.app.emergency.dto.*;
import com.app.emergency.entity.EmergencyContact;
import com.app.emergency.service.EmergencyService;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/emergency")
public class EmergencyController {

    private final EmergencyService emergencyService;
    private final UserRepository userRepository;

    public EmergencyController(EmergencyService emergencyService, UserRepository userRepository) {
        this.emergencyService = emergencyService;
        this.userRepository = userRepository;
    }

    /** Patient triggers SOS */
    @PostMapping("/sos")
    public ResponseEntity<ApiResponse<EmergencyResponse>> triggerSos(
            @Valid @RequestBody SosRequest request,
            Authentication authentication) {
        UUID patientId = resolveUserId(authentication);
        EmergencyResponse response = emergencyService.createEmergency(request, patientId);
        return ResponseEntity.ok(ApiResponse.success(response, "Emergency SOS activated. Searching for ambulance..."));
    }

    /** Get live status of a specific emergency */
    @GetMapping("/{emergencyId}")
    public ResponseEntity<ApiResponse<EmergencyResponse>> getEmergencyStatus(
            @PathVariable UUID emergencyId,
            Authentication authentication) {
        UUID requesterId = resolveUserId(authentication);
        EmergencyResponse response = emergencyService.getEmergencyStatus(emergencyId, requesterId);
        return ResponseEntity.ok(ApiResponse.success(response, "Emergency status retrieved"));
    }

    /** Patient cancels their emergency */
    @PutMapping("/{emergencyId}/cancel")
    public ResponseEntity<ApiResponse<EmergencyResponse>> cancelEmergency(
            @PathVariable UUID emergencyId,
            Authentication authentication) {
        UUID patientId = resolveUserId(authentication);
        EmergencyResponse response = emergencyService.cancelEmergency(emergencyId, patientId);
        return ResponseEntity.ok(ApiResponse.success(response, "Emergency cancelled"));
    }

    /** Patient's emergency history */
    @GetMapping("/history")
    public ResponseEntity<ApiResponse<List<EmergencyResponse>>> getHistory(Authentication authentication) {
        UUID patientId = resolveUserId(authentication);
        List<EmergencyResponse> history = emergencyService.getPatientHistory(patientId);
        return ResponseEntity.ok(ApiResponse.success(history, "Emergency history retrieved"));
    }

    /** Register an emergency contact */
    @PostMapping("/contacts")
    public ResponseEntity<ApiResponse<EmergencyContact>> addContact(
            @Valid @RequestBody EmergencyContactRequest request,
            Authentication authentication) {
        UUID patientId = resolveUserId(authentication);
        EmergencyContact contact = emergencyService.addEmergencyContact(request, patientId);
        return ResponseEntity.ok(ApiResponse.success(contact, "Emergency contact added"));
    }

    /** List all emergency contacts */
    @GetMapping("/contacts")
    public ResponseEntity<ApiResponse<List<EmergencyContact>>> getContacts(Authentication authentication) {
        UUID patientId = resolveUserId(authentication);
        List<EmergencyContact> contacts = emergencyService.getEmergencyContacts(patientId);
        return ResponseEntity.ok(ApiResponse.success(contacts, "Emergency contacts retrieved"));
    }

    /** Remove an emergency contact */
    @DeleteMapping("/contacts/{contactId}")
    public ResponseEntity<ApiResponse<Void>> deleteContact(
            @PathVariable UUID contactId,
            Authentication authentication) {
        UUID patientId = resolveUserId(authentication);
        emergencyService.deleteEmergencyContact(contactId, patientId);
        return ResponseEntity.ok(ApiResponse.success(null, "Emergency contact removed"));
    }

    private UUID resolveUserId(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}
