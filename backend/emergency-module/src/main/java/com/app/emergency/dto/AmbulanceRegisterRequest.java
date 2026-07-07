package com.app.emergency.dto;

import com.app.emergency.entity.AmbulanceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class AmbulanceRegisterRequest {

    @NotBlank(message = "Vehicle number is required")
    private String vehicleNumber;

    @NotNull(message = "Ambulance type is required")
    private AmbulanceType ambulanceType;

    private String equipmentNotes;

    public String getVehicleNumber() { return vehicleNumber; }
    public void setVehicleNumber(String vehicleNumber) { this.vehicleNumber = vehicleNumber; }

    public AmbulanceType getAmbulanceType() { return ambulanceType; }
    public void setAmbulanceType(AmbulanceType ambulanceType) { this.ambulanceType = ambulanceType; }

    public String getEquipmentNotes() { return equipmentNotes; }
    public void setEquipmentNotes(String equipmentNotes) { this.equipmentNotes = equipmentNotes; }
}
