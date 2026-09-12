package com.app.pharmacy.repository;

import com.app.pharmacy.entity.InventoryImportJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface InventoryImportJobRepository extends JpaRepository<InventoryImportJob, UUID> {
    List<InventoryImportJob> findByPharmacyIdOrderByCreatedAtDesc(UUID pharmacyId);
}
