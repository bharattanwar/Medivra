package com.app.pharmacy.repository;

import com.app.pharmacy.entity.MedicineOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MedicineOrderItemRepository extends JpaRepository<MedicineOrderItem, UUID> {
    List<MedicineOrderItem> findByOrderId(UUID orderId);
    List<MedicineOrderItem> findByPharmacyIdOrderByCreatedAtDesc(UUID pharmacyId);
}
