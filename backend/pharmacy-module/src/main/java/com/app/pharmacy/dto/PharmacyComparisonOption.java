package com.app.pharmacy.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public class PharmacyComparisonOption {

    private String type; // FASTEST, CHEAPEST, BEST_VALUE
    private UUID pharmacyId;
    private String pharmacyName;
    private String pharmacyAddress;
    private Double distanceKm;
    private Integer estimatedMinutes;
    private BigDecimal medicineTotal;
    private BigDecimal deliveryFee;
    private BigDecimal totalPayable;
    private BigDecimal savingsAmount;
    private String badgeLabel;
    private List<AllocatedItem> items;
    private boolean selected;

    public PharmacyComparisonOption() {}

    public PharmacyComparisonOption(String type, UUID pharmacyId, String pharmacyName,
                                    String pharmacyAddress, Double distanceKm, Integer estimatedMinutes,
                                    BigDecimal medicineTotal, BigDecimal deliveryFee, BigDecimal totalPayable,
                                    BigDecimal savingsAmount, String badgeLabel, List<AllocatedItem> items,
                                    boolean selected) {
        this.type = type;
        this.pharmacyId = pharmacyId;
        this.pharmacyName = pharmacyName;
        this.pharmacyAddress = pharmacyAddress;
        this.distanceKm = distanceKm;
        this.estimatedMinutes = estimatedMinutes;
        this.medicineTotal = medicineTotal;
        this.deliveryFee = deliveryFee;
        this.totalPayable = totalPayable;
        this.savingsAmount = savingsAmount;
        this.badgeLabel = badgeLabel;
        this.items = items;
        this.selected = selected;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public UUID getPharmacyId() {
        return pharmacyId;
    }

    public void setPharmacyId(UUID pharmacyId) {
        this.pharmacyId = pharmacyId;
    }

    public String getPharmacyName() {
        return pharmacyName;
    }

    public void setPharmacyName(String pharmacyName) {
        this.pharmacyName = pharmacyName;
    }

    public String getPharmacyAddress() {
        return pharmacyAddress;
    }

    public void setPharmacyAddress(String pharmacyAddress) {
        this.pharmacyAddress = pharmacyAddress;
    }

    public Double getDistanceKm() {
        return distanceKm;
    }

    public void setDistanceKm(Double distanceKm) {
        this.distanceKm = distanceKm;
    }

    public Integer getEstimatedMinutes() {
        return estimatedMinutes;
    }

    public void setEstimatedMinutes(Integer estimatedMinutes) {
        this.estimatedMinutes = estimatedMinutes;
    }

    public BigDecimal getMedicineTotal() {
        return medicineTotal;
    }

    public void setMedicineTotal(BigDecimal medicineTotal) {
        this.medicineTotal = medicineTotal;
    }

    public BigDecimal getDeliveryFee() {
        return deliveryFee;
    }

    public void setDeliveryFee(BigDecimal deliveryFee) {
        this.deliveryFee = deliveryFee;
    }

    public BigDecimal getTotalPayable() {
        return totalPayable;
    }

    public void setTotalPayable(BigDecimal totalPayable) {
        this.totalPayable = totalPayable;
    }

    public BigDecimal getSavingsAmount() {
        return savingsAmount;
    }

    public void setSavingsAmount(BigDecimal savingsAmount) {
        this.savingsAmount = savingsAmount;
    }

    public String getBadgeLabel() {
        return badgeLabel;
    }

    public void setBadgeLabel(String badgeLabel) {
        this.badgeLabel = badgeLabel;
    }

    public List<AllocatedItem> getItems() {
        return items;
    }

    public void setItems(List<AllocatedItem> items) {
        this.items = items;
    }

    public boolean isSelected() {
        return selected;
    }

    public void setSelected(boolean selected) {
        this.selected = selected;
    }
}
