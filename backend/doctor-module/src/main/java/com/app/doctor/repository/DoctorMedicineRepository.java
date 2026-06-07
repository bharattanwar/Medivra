package com.app.doctor.repository;

import com.app.doctor.entity.DoctorMedicine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DoctorMedicineRepository extends JpaRepository<DoctorMedicine, UUID> {
    List<DoctorMedicine> findByDoctorIdOrderByNameAsc(UUID doctorId);
    List<DoctorMedicine> findByDoctorIdAndNameContainingIgnoreCase(UUID doctorId, String name);
}
