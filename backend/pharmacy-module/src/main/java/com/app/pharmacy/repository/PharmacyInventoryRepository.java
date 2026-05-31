package com.app.pharmacy.repository;

import com.app.pharmacy.entity.PharmacyInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PharmacyInventoryRepository extends JpaRepository<PharmacyInventory, UUID> {
    List<PharmacyInventory> findByPharmacyId(UUID pharmacyId);
    List<PharmacyInventory> findByMedicineId(UUID medicineId);
    Optional<PharmacyInventory> findByPharmacyIdAndMedicineId(UUID pharmacyId, UUID medicineId);
}
