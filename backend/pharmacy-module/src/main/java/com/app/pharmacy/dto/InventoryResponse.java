package com.app.pharmacy.dto;

import java.math.BigDecimal;
import java.util.UUID;

public class InventoryResponse {

    private UUID inventoryId;
    private UUID medicineId;
    private String medicineName;
    private String manufacturer;
    private String strength;
    private Integer quantity;
    private BigDecimal price;

    public InventoryResponse() {}

    public InventoryResponse(UUID inventoryId, UUID medicineId, String medicineName,
                             String manufacturer, String strength, Integer quantity, BigDecimal price) {
        this.inventoryId = inventoryId;
        this.medicineId = medicineId;
        this.medicineName = medicineName;
        this.manufacturer = manufacturer;
        this.strength = strength;
        this.quantity = quantity;
        this.price = price;
    }

    public UUID getInventoryId() {
        return inventoryId;
    }

    public void setInventoryId(UUID inventoryId) {
        this.inventoryId = inventoryId;
    }

    public UUID getMedicineId() {
        return medicineId;
    }

    public void setMedicineId(UUID medicineId) {
        this.medicineId = medicineId;
    }

    public String getMedicineName() {
        return medicineName;
    }

    public void setMedicineName(String medicineName) {
        this.medicineName = medicineName;
    }

    public String getManufacturer() {
        return manufacturer;
    }

    public void setManufacturer(String manufacturer) {
        this.manufacturer = manufacturer;
    }

    public String getStrength() {
        return strength;
    }

    public void setStrength(String strength) {
        this.strength = strength;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }
}
