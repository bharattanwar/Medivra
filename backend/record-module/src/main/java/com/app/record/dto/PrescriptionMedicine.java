package com.app.record.dto;

public class PrescriptionMedicine {
    private String name;
    private String strength;
    private String dosage;
    private String frequency;
    private String duration;

    public PrescriptionMedicine() {}

    public PrescriptionMedicine(String name, String strength, String dosage, String frequency, String duration) {
        this.name = name;
        this.strength = strength;
        this.dosage = dosage;
        this.frequency = frequency;
        this.duration = duration;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getStrength() { return strength; }
    public void setStrength(String strength) { this.strength = strength; }

    public String getDosage() { return dosage; }
    public void setDosage(String dosage) { this.dosage = dosage; }

    public String getFrequency() { return frequency; }
    public void setFrequency(String frequency) { this.frequency = frequency; }

    public String getDuration() { return duration; }
    public void setDuration(String duration) { this.duration = duration; }
}
