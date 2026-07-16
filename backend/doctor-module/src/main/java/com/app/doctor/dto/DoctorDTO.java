package com.app.doctor.dto;

import java.math.BigDecimal;
import java.util.UUID;

public class DoctorDTO {
    private UUID id;
    private String fullName;
    private String email;
    private String specialization;
    private Integer experienceYears;
    private BigDecimal consultationFee;
    private String hospitalName;
    private String city;
    private Double rating;
    private String profileImageUrl;
    private Boolean isAvailable;
    private Boolean availableInClinic;
    private Boolean availableVideo;

    public DoctorDTO() {}

    public DoctorDTO(UUID id, String fullName, String email, String specialization, Integer experienceYears,
                     BigDecimal consultationFee, String hospitalName, String city, Double rating,
                     String profileImageUrl, Boolean isAvailable, Boolean availableInClinic, Boolean availableVideo) {
        this.id = id;
        this.fullName = fullName;
        this.email = email;
        this.specialization = specialization;
        this.experienceYears = experienceYears;
        this.consultationFee = consultationFee;
        this.hospitalName = hospitalName;
        this.city = city;
        this.rating = rating;
        this.profileImageUrl = profileImageUrl;
        this.isAvailable = isAvailable;
        this.availableInClinic = availableInClinic;
        this.availableVideo = availableVideo;
    }

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getSpecialization() { return specialization; }
    public void setSpecialization(String specialization) { this.specialization = specialization; }

    public Integer getExperienceYears() { return experienceYears; }
    public void setExperienceYears(Integer experienceYears) { this.experienceYears = experienceYears; }

    public BigDecimal getConsultationFee() { return consultationFee; }
    public void setConsultationFee(BigDecimal consultationFee) { this.consultationFee = consultationFee; }

    public String getHospitalName() { return hospitalName; }
    public void setHospitalName(String hospitalName) { this.hospitalName = hospitalName; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public Double getRating() { return rating; }
    public void setRating(Double rating) { this.rating = rating; }

    public String getProfileImageUrl() { return profileImageUrl; }
    public void setProfileImageUrl(String profileImageUrl) { this.profileImageUrl = profileImageUrl; }

    public Boolean getIsAvailable() { return isAvailable; }
    public void setIsAvailable(Boolean isAvailable) { this.isAvailable = isAvailable; }

    public Boolean getAvailableInClinic() { return availableInClinic; }
    public void setAvailableInClinic(Boolean availableInClinic) { this.availableInClinic = availableInClinic; }

    public Boolean getAvailableVideo() { return availableVideo; }
    public void setAvailableVideo(Boolean availableVideo) { this.availableVideo = availableVideo; }
}
