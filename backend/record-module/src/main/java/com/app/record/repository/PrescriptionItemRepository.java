package com.app.record.repository;

import com.app.record.entity.PrescriptionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PrescriptionItemRepository extends JpaRepository<PrescriptionItem, UUID> {
    List<PrescriptionItem> findByMedicalRecordId(UUID medicalRecordId);
    void deleteByMedicalRecordId(UUID medicalRecordId);
}
