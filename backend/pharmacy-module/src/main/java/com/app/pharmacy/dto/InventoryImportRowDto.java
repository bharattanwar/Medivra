package com.app.pharmacy.dto;

import java.math.BigDecimal;

public class InventoryImportRowDto {

    private int rowNumber;
    private String medicineName;
    private String strength;
    private String manufacturer;
    private Integer quantity;
    private BigDecimal price;
    private String expiryDate;
    private String status; // VALID, WARNING, ERROR
    private String validationError;
    private boolean selected = true;

    public InventoryImportRowDto() {}

    public InventoryImportRowDto(int rowNumber, String medicineName, String strength,
                                String manufacturer, Integer quantity, BigDecimal price,
                                String expiryDate, String status, String validationError) {
        this.rowNumber = rowNumber;
        this.medicineName = medicineName;
        this.strength = strength;
        this.manufacturer = manufacturer;
        this.quantity = quantity;
        this.price = price;
        this.expiryDate = expiryDate;
        this.status = status;
        this.validationError = validationError;
        this.selected = !"ERROR".equalsIgnoreCase(status);
    }

    public int getRowNumber() {
        return rowNumber;
    }

    public void setRowNumber(int rowNumber) {
        this.rowNumber = rowNumber;
    }

    public String getMedicineName() {
        return medicineName;
    }

    public void setMedicineName(String medicineName) {
        this.medicineName = medicineName;
    }

    public String getStrength() {
        return strength;
    }

    public void setStrength(String strength) {
        this.strength = strength;
    }

    public String getManufacturer() {
        return manufacturer;
    }

    public void setManufacturer(String manufacturer) {
        this.manufacturer = manufacturer;
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

    public String getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(String expiryDate) {
        this.expiryDate = expiryDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getValidationError() {
        return validationError;
    }

    public void setValidationError(String validationError) {
        this.validationError = validationError;
    }

    public boolean isSelected() {
        return selected;
    }

    public void setSelected(boolean selected) {
        this.selected = selected;
    }
}
