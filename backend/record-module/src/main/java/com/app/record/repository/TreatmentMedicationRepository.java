package com.app.record.repository;

import com.app.record.entity.TreatmentMedication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TreatmentMedicationRepository extends JpaRepository<TreatmentMedication, UUID> {
    List<TreatmentMedication> findByTreatmentPlanId(UUID treatmentPlanId);
    List<TreatmentMedication> findByTreatmentPlanIdAndStatus(UUID treatmentPlanId, String status);
}
