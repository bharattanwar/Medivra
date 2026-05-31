package com.app.pharmacy.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public class PharmacyAllocation {

    private UUID pharmacyId;
    private String pharmacyName;
    private String pharmacyAddress;
    private Double distanceKm;
    private Double score;
    private List<AllocatedItem> items;
    private BigDecimal subtotal;

    public PharmacyAllocation() {}

    public PharmacyAllocation(UUID pharmacyId, String pharmacyName, String pharmacyAddress,
                               Double distanceKm, Double score, List<AllocatedItem> items, BigDecimal subtotal) {
        this.pharmacyId = pharmacyId;
        this.pharmacyName = pharmacyName;
        this.pharmacyAddress = pharmacyAddress;
        this.distanceKm = distanceKm;
        this.score = score;
        this.items = items;
        this.subtotal = subtotal;
    }

    public UUID getPharmacyId() { return pharmacyId; }
    public void setPharmacyId(UUID pharmacyId) { this.pharmacyId = pharmacyId; }

    public String getPharmacyName() { return pharmacyName; }
    public void setPharmacyName(String pharmacyName) { this.pharmacyName = pharmacyName; }

    public String getPharmacyAddress() { return pharmacyAddress; }
    public void setPharmacyAddress(String pharmacyAddress) { this.pharmacyAddress = pharmacyAddress; }

    public Double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(Double distanceKm) { this.distanceKm = distanceKm; }

    public Double getScore() { return score; }
    public void setScore(Double score) { this.score = score; }

    public List<AllocatedItem> getItems() { return items; }
    public void setItems(List<AllocatedItem> items) { this.items = items; }

    public BigDecimal getSubtotal() { return subtotal; }
    public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }
}
