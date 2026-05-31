package com.app.pharmacy.dto;

import java.util.UUID;

public class MedicineResponse {

    private UUID id;
    private String name;
    private String manufacturer;
    private String strength;

    public MedicineResponse() {}

    public MedicineResponse(UUID id, String name, String manufacturer, String strength) {
        this.id = id;
        this.name = name;
        this.manufacturer = manufacturer;
        this.strength = strength;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getManufacturer() { return manufacturer; }
    public void setManufacturer(String manufacturer) { this.manufacturer = manufacturer; }

    public String getStrength() { return strength; }
    public void setStrength(String strength) { this.strength = strength; }
}
