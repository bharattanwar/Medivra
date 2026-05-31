package com.app.pharmacy.dto;

import java.util.UUID;

public class NearbyPharmacyResponse {

    private UUID id;
    private String name;
    private String address;
    private Double distanceKm;
    private Double latitude;
    private Double longitude;
    private String phoneNumber;
    private int inventoryCount;

    public NearbyPharmacyResponse() {}

    public NearbyPharmacyResponse(UUID id, String name, String address, Double distanceKm,
                                   Double latitude, Double longitude, String phoneNumber, int inventoryCount) {
        this.id = id;
        this.name = name;
        this.address = address;
        this.distanceKm = distanceKm;
        this.latitude = latitude;
        this.longitude = longitude;
        this.phoneNumber = phoneNumber;
        this.inventoryCount = inventoryCount;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public Double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(Double distanceKm) { this.distanceKm = distanceKm; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public int getInventoryCount() { return inventoryCount; }
    public void setInventoryCount(int inventoryCount) { this.inventoryCount = inventoryCount; }
}
