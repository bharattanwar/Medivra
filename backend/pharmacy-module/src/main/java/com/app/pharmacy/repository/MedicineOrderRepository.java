package com.app.pharmacy.repository;

import com.app.pharmacy.entity.MedicineOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MedicineOrderRepository extends JpaRepository<MedicineOrder, UUID> {
    List<MedicineOrder> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
}
