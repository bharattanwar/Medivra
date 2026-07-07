package com.app.emergency.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "emergency_requests")
public class EmergencyRequest extends BaseEntity {

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "patient_lat", nullable = false)
    private Double patientLat;

    @Column(name = "patient_lng", nullable = false)
    private Double patientLng;

    @Column(name = "patient_address")
    private String patientAddress;

    @Enumerated(EnumType.STRING)
    @Column(name = "emergency_type", nullable = false)
    private EmergencyType emergencyType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private EmergencyStatus status = EmergencyStatus.PENDING;

    @Column(name = "assigned_ambulance_id")
    private UUID assignedAmbulanceId;

    @Column(name = "assigned_hospital_id")
    private UUID assignedHospitalId;

    @Column(name = "search_radius_km")
    private Double searchRadiusKm = 5.0;

    @Column(name = "estimated_arrival_minutes")
    private Integer estimatedArrivalMinutes;

    @Column(name = "escalation_count")
    private Integer escalationCount = 0;

    @Column(name = "notes")
    private String notes;

    // Optimistic locking to support first-accept-wins race condition
    @Version
    @Column(name = "version")
    private Long version;

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

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

    public UUID getAssignedAmbulanceId() { return assignedAmbulanceId; }
    public void setAssignedAmbulanceId(UUID assignedAmbulanceId) { this.assignedAmbulanceId = assignedAmbulanceId; }

    public UUID getAssignedHospitalId() { return assignedHospitalId; }
    public void setAssignedHospitalId(UUID assignedHospitalId) { this.assignedHospitalId = assignedHospitalId; }

    public Double getSearchRadiusKm() { return searchRadiusKm; }
    public void setSearchRadiusKm(Double searchRadiusKm) { this.searchRadiusKm = searchRadiusKm; }

    public Integer getEstimatedArrivalMinutes() { return estimatedArrivalMinutes; }
    public void setEstimatedArrivalMinutes(Integer estimatedArrivalMinutes) { this.estimatedArrivalMinutes = estimatedArrivalMinutes; }

    public Integer getEscalationCount() { return escalationCount; }
    public void setEscalationCount(Integer escalationCount) { this.escalationCount = escalationCount; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
