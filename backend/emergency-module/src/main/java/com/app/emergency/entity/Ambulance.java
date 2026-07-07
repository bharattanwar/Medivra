package com.app.emergency.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ambulances")
public class Ambulance extends BaseEntity {

    @Column(name = "vehicle_number", nullable = false, unique = true)
    private String vehicleNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "ambulance_type", nullable = false)
    private AmbulanceType ambulanceType;

    @Column(name = "driver_id")
    private UUID driverId;

    @Column(name = "registered_hospital_id")
    private UUID registeredHospitalId;

    @Column(name = "current_lat")
    private Double currentLat;

    @Column(name = "current_lng")
    private Double currentLng;

    @Column(name = "is_online", nullable = false)
    private Boolean isOnline = false;

    @Column(name = "is_available", nullable = false)
    private Boolean isAvailable = true;

    @Column(name = "last_location_update")
    private LocalDateTime lastLocationUpdate;

    @Column(name = "equipment_notes")
    private String equipmentNotes;

    public String getVehicleNumber() { return vehicleNumber; }
    public void setVehicleNumber(String vehicleNumber) { this.vehicleNumber = vehicleNumber; }

    public AmbulanceType getAmbulanceType() { return ambulanceType; }
    public void setAmbulanceType(AmbulanceType ambulanceType) { this.ambulanceType = ambulanceType; }

    public UUID getDriverId() { return driverId; }
    public void setDriverId(UUID driverId) { this.driverId = driverId; }

    public UUID getRegisteredHospitalId() { return registeredHospitalId; }
    public void setRegisteredHospitalId(UUID registeredHospitalId) { this.registeredHospitalId = registeredHospitalId; }

    public Double getCurrentLat() { return currentLat; }
    public void setCurrentLat(Double currentLat) { this.currentLat = currentLat; }

    public Double getCurrentLng() { return currentLng; }
    public void setCurrentLng(Double currentLng) { this.currentLng = currentLng; }

    public Boolean getIsOnline() { return isOnline; }
    public void setIsOnline(Boolean isOnline) { this.isOnline = isOnline; }

    public Boolean getIsAvailable() { return isAvailable; }
    public void setIsAvailable(Boolean isAvailable) { this.isAvailable = isAvailable; }

    public LocalDateTime getLastLocationUpdate() { return lastLocationUpdate; }
    public void setLastLocationUpdate(LocalDateTime lastLocationUpdate) { this.lastLocationUpdate = lastLocationUpdate; }

    public String getEquipmentNotes() { return equipmentNotes; }
    public void setEquipmentNotes(String equipmentNotes) { this.equipmentNotes = equipmentNotes; }
}
