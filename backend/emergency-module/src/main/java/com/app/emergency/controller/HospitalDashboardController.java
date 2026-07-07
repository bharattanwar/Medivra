package com.app.emergency.controller;

import com.app.common.dto.ApiResponse;
import com.app.emergency.entity.*;
import com.app.emergency.repository.*;
import com.app.emergency.dto.EmergencyResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/hospital")
public class HospitalDashboardController {

    private final EmergencyRequestRepository emergencyRequestRepository;
    private final AmbulanceRepository ambulanceRepository;
    private final AmbulanceDriverRepository driverRepository;
    private final EmergencyTimelineRepository timelineRepository;

    public HospitalDashboardController(
            EmergencyRequestRepository emergencyRequestRepository,
            AmbulanceRepository ambulanceRepository,
            AmbulanceDriverRepository driverRepository,
            EmergencyTimelineRepository timelineRepository) {
        this.emergencyRequestRepository = emergencyRequestRepository;
        this.ambulanceRepository = ambulanceRepository;
        this.driverRepository = driverRepository;
        this.timelineRepository = timelineRepository;
    }

    /** Active incoming emergencies routed to this hospital */
    @GetMapping("/emergencies/active")
    public ResponseEntity<ApiResponse<List<EmergencyResponse>>> getActiveEmergencies(
            @RequestParam(required = false) UUID hospitalId) {
        List<EmergencyStatus> activeStatuses = List.of(
                EmergencyStatus.AMBULANCE_ASSIGNED,
                EmergencyStatus.EN_ROUTE,
                EmergencyStatus.ARRIVED_AT_PATIENT,
                EmergencyStatus.TRANSPORTING);

        List<EmergencyRequest> emergencies = hospitalId != null
                ? emergencyRequestRepository.findByAssignedHospitalIdAndStatusIn(hospitalId, activeStatuses)
                : emergencyRequestRepository.findByStatusInOrderByCreatedAtAsc(activeStatuses);

        List<EmergencyResponse> responses = emergencies.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(responses, "Active emergencies retrieved"));
    }

    /** Fleet overview — all ambulances with online/busy status */
    @GetMapping("/ambulances")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getFleetStatus() {
        List<Map<String, Object>> fleet = ambulanceRepository.findAll().stream().map(amb -> {
            Map<String, Object> entry = new HashMap<>();
            entry.put("id", amb.getId());
            entry.put("vehicleNumber", amb.getVehicleNumber());
            entry.put("type", amb.getAmbulanceType().name());
            entry.put("isOnline", amb.getIsOnline());
            entry.put("isAvailable", amb.getIsAvailable());
            entry.put("lat", amb.getCurrentLat());
            entry.put("lng", amb.getCurrentLng());
            entry.put("lastUpdate", amb.getLastLocationUpdate());
            if (amb.getDriverId() != null) {
                driverRepository.findById(amb.getDriverId()).ifPresent(d -> {
                    entry.put("driverName", d.getFullName());
                    entry.put("driverPhone", d.getPhone());
                });
            }
            return entry;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(fleet, "Fleet status retrieved"));
    }

    /** Emergency analytics */
    @GetMapping("/emergencies/analytics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAnalytics() {
        Map<String, Object> analytics = new HashMap<>();

        LocalDateTime todayStart = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0);
        long todayCount = emergencyRequestRepository.countByCreatedAtAfter(todayStart);

        long totalOnlineAmbulances = ambulanceRepository.findByIsOnlineTrueAndIsAvailableTrue().size();

        List<EmergencyRequest> active = emergencyRequestRepository.findByStatusInOrderByCreatedAtAsc(
                List.of(EmergencyStatus.AMBULANCE_ASSIGNED, EmergencyStatus.EN_ROUTE,
                        EmergencyStatus.ARRIVED_AT_PATIENT, EmergencyStatus.TRANSPORTING));

        analytics.put("todayEmergencies", todayCount);
        analytics.put("activeEmergencies", active.size());
        analytics.put("availableAmbulances", totalOnlineAmbulances);
        analytics.put("timestamp", LocalDateTime.now());

        return ResponseEntity.ok(ApiResponse.success(analytics, "Analytics retrieved"));
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
        r.setEscalationCount(e.getEscalationCount());

        if (e.getAssignedAmbulanceId() != null) {
            ambulanceRepository.findById(e.getAssignedAmbulanceId()).ifPresent(amb -> {
                r.setVehicleNumber(amb.getVehicleNumber());
                r.setAmbulanceType(amb.getAmbulanceType().name());
                r.setAmbulanceLat(amb.getCurrentLat());
                r.setAmbulanceLng(amb.getCurrentLng());
                if (amb.getDriverId() != null) {
                    driverRepository.findById(amb.getDriverId()).ifPresent(d -> {
                        r.setDriverName(d.getFullName());
                        r.setDriverPhone(d.getPhone());
                    });
                }
            });
        }

        List<EmergencyResponse.TimelineEntryDto> timeline = timelineRepository
                .findByEmergencyIdOrderByEventTimestampAsc(e.getId())
                .stream().map(t -> {
                    EmergencyResponse.TimelineEntryDto dto = new EmergencyResponse.TimelineEntryDto();
                    dto.setEvent(t.getEvent().name());
                    dto.setDescription(t.getDescription());
                    dto.setTimestamp(t.getEventTimestamp());
                    return dto;
                }).collect(Collectors.toList());
        r.setTimeline(timeline);

        return r;
    }
}
