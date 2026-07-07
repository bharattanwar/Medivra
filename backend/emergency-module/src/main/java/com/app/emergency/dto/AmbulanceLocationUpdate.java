package com.app.emergency.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class AmbulanceLocationUpdate {
    private UUID ambulanceId;
    private UUID emergencyId;
    private Double lat;
    private Double lng;
    private LocalDateTime timestamp;
    private Integer estimatedArrivalMinutes;

    public AmbulanceLocationUpdate() {}

    public AmbulanceLocationUpdate(UUID ambulanceId, UUID emergencyId, Double lat, Double lng,
                                    LocalDateTime timestamp, Integer estimatedArrivalMinutes) {
        this.ambulanceId = ambulanceId;
        this.emergencyId = emergencyId;
        this.lat = lat;
        this.lng = lng;
        this.timestamp = timestamp;
        this.estimatedArrivalMinutes = estimatedArrivalMinutes;
    }

    public UUID getAmbulanceId() { return ambulanceId; }
    public void setAmbulanceId(UUID ambulanceId) { this.ambulanceId = ambulanceId; }

    public UUID getEmergencyId() { return emergencyId; }
    public void setEmergencyId(UUID emergencyId) { this.emergencyId = emergencyId; }

    public Double getLat() { return lat; }
    public void setLat(Double lat) { this.lat = lat; }

    public Double getLng() { return lng; }
    public void setLng(Double lng) { this.lng = lng; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public Integer getEstimatedArrivalMinutes() { return estimatedArrivalMinutes; }
    public void setEstimatedArrivalMinutes(Integer estimatedArrivalMinutes) { this.estimatedArrivalMinutes = estimatedArrivalMinutes; }
}
