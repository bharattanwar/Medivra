package com.app.doctor.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "doctor_medicines")
public class DoctorMedicine extends BaseEntity {

    @Column(name = "doctor_id", nullable = false)
    private UUID doctorId;

    @Column(nullable = false)
    private String name;

    @Column
    private String strength;

    public DoctorMedicine() {}

    public DoctorMedicine(UUID doctorId, String name, String strength) {
        this.doctorId = doctorId;
        this.name = name;
        this.strength = strength;
    }

    public UUID getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(UUID doctorId) {
        this.doctorId = doctorId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getStrength() {
        return strength;
    }

    public void setStrength(String strength) {
        this.strength = strength;
    }
}
