package com.app.pharmacy.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public class PharmacyMatchRequest {

    @NotNull(message = "User latitude is required")
    private Double userLatitude;

    @NotNull(message = "User longitude is required")
    private Double userLongitude;

    private Double radiusKm = 5.0;

    @NotEmpty(message = "At least one medicine is required")
    @Valid
    private List<MedicineItem> medicines;

    public static class MedicineItem {
        @NotNull(message = "Medicine ID is required")
        private UUID medicineId;

        @NotNull(message = "Quantity is required")
        private Integer quantity;

        public UUID getMedicineId() { return medicineId; }
        public void setMedicineId(UUID medicineId) { this.medicineId = medicineId; }

        public Integer getQuantity() { return quantity; }
        public void setQuantity(Integer quantity) { this.quantity = quantity; }
    }

    public Double getUserLatitude() { return userLatitude; }
    public void setUserLatitude(Double userLatitude) { this.userLatitude = userLatitude; }

    public Double getUserLongitude() { return userLongitude; }
    public void setUserLongitude(Double userLongitude) { this.userLongitude = userLongitude; }

    public Double getRadiusKm() { return radiusKm; }
    public void setRadiusKm(Double radiusKm) { this.radiusKm = radiusKm; }

    public List<MedicineItem> getMedicines() { return medicines; }
    public void setMedicines(List<MedicineItem> medicines) { this.medicines = medicines; }
}
