package com.app.emergency.dto;

import com.app.emergency.entity.EmergencyStatus;
import com.app.emergency.entity.EmergencyType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class EmergencyResponse {

    private UUID id;
    private UUID patientId;
    private String patientName;
    private Double patientLat;
    private Double patientLng;
    private String patientAddress;
    private EmergencyType emergencyType;
    private EmergencyStatus status;
    private Integer estimatedArrivalMinutes;
    private Integer escalationCount;
    private LocalDateTime createdAt;

    // Ambulance info (populated after assignment)
    private UUID assignedAmbulanceId;
    private String vehicleNumber;
    private String ambulanceType;
    private Double ambulanceLat;
    private Double ambulanceLng;

    // Driver info
    private String driverName;
    private String driverPhone;

    // Timeline
    private List<TimelineEntryDto> timeline;

    // Nested DTO
    public static class TimelineEntryDto {
        private String event;
        private String description;
        private LocalDateTime timestamp;

        public String getEvent() { return event; }
        public void setEvent(String event) { this.event = event; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public LocalDateTime getTimestamp() { return timestamp; }
        public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public String getPatientName() { return patientName; }
    public void setPatientName(String patientName) { this.patientName = patientName; }

    public Double getPatientLat() { return patientLat; }
    public void setPatientLat(Double patientLat) { this.patientLat = patientLat; }

    public Double getPatientLng() { return patientLng; }
    public void setPatientLng(Double patientLng) { this.patientLng = patientLng; }

    public String getPatientAddress() { return patientAddress; }
    public void setPatientAddress(String patientAddress) { this.patientAddress = patientAddress; }

    public EmergencyType getEmergencyType() { return emergencyType; }
    public void setEmergencyType(EmergencyType emergencyType) { this.emergencyType = emergencyType; }

    public EmergencyStatus getStatus() { return status; }
    public void setStatus(EmergencyStatus status) { this.status = status; }

    public Integer getEstimatedArrivalMinutes() { return estimatedArrivalMinutes; }
    public void setEstimatedArrivalMinutes(Integer estimatedArrivalMinutes) { this.estimatedArrivalMinutes = estimatedArrivalMinutes; }

    public Integer getEscalationCount() { return escalationCount; }
    public void setEscalationCount(Integer escalationCount) { this.escalationCount = escalationCount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public UUID getAssignedAmbulanceId() { return assignedAmbulanceId; }
    public void setAssignedAmbulanceId(UUID assignedAmbulanceId) { this.assignedAmbulanceId = assignedAmbulanceId; }

    public String getVehicleNumber() { return vehicleNumber; }
    public void setVehicleNumber(String vehicleNumber) { this.vehicleNumber = vehicleNumber; }

    public String getAmbulanceType() { return ambulanceType; }
    public void setAmbulanceType(String ambulanceType) { this.ambulanceType = ambulanceType; }

    public Double getAmbulanceLat() { return ambulanceLat; }
    public void setAmbulanceLat(Double ambulanceLat) { this.ambulanceLat = ambulanceLat; }

    public Double getAmbulanceLng() { return ambulanceLng; }
    public void setAmbulanceLng(Double ambulanceLng) { this.ambulanceLng = ambulanceLng; }

    public String getDriverName() { return driverName; }
    public void setDriverName(String driverName) { this.driverName = driverName; }

    public String getDriverPhone() { return driverPhone; }
    public void setDriverPhone(String driverPhone) { this.driverPhone = driverPhone; }

    public List<TimelineEntryDto> getTimeline() { return timeline; }
    public void setTimeline(List<TimelineEntryDto> timeline) { this.timeline = timeline; }
}
