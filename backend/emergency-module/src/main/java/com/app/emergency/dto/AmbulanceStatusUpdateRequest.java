package com.app.emergency.dto;

import com.app.emergency.entity.EmergencyStatus;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public class AmbulanceStatusUpdateRequest {

    @NotNull
    private UUID emergencyId;

    @NotNull
    private EmergencyStatus newStatus;

    private String notes;

    public UUID getEmergencyId() { return emergencyId; }
    public void setEmergencyId(UUID emergencyId) { this.emergencyId = emergencyId; }

    public EmergencyStatus getNewStatus() { return newStatus; }
    public void setNewStatus(EmergencyStatus newStatus) { this.newStatus = newStatus; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
