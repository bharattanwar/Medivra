package com.app.pharmacy.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public class CheckoutRequest {

    private UUID patientId;
    private UUID prescriptionId;
    private String deliveryAddress;
    private Double userLatitude;
    private Double userLongitude;
    private List<CheckoutItem> items;

    public UUID getPatientId() {
        return patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public UUID getPrescriptionId() {
        return prescriptionId;
    }

    public void setPrescriptionId(UUID prescriptionId) {
        this.prescriptionId = prescriptionId;
    }

    public String getDeliveryAddress() {
        return deliveryAddress;
    }

    public void setDeliveryAddress(String deliveryAddress) {
        this.deliveryAddress = deliveryAddress;
    }

    public Double getUserLatitude() {
        return userLatitude;
    }

    public void setUserLatitude(Double userLatitude) {
        this.userLatitude = userLatitude;
    }

    public Double getUserLongitude() {
        return userLongitude;
    }

    public void setUserLongitude(Double userLongitude) {
        this.userLongitude = userLongitude;
    }

    public List<CheckoutItem> getItems() {
        return items;
    }

    public void setItems(List<CheckoutItem> items) {
        this.items = items;
    }

    public static class CheckoutItem {
        private UUID pharmacyId;
        private UUID medicineId;
        private Integer quantity;
        private BigDecimal price;

        public UUID getPharmacyId() {
            return pharmacyId;
        }

        public void setPharmacyId(UUID pharmacyId) {
            this.pharmacyId = pharmacyId;
        }

        public UUID getMedicineId() {
            return medicineId;
        }

        public void setMedicineId(UUID medicineId) {
            this.medicineId = medicineId;
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
}
