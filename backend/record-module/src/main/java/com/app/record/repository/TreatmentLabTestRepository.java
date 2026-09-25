package com.app.record.repository;

import com.app.record.entity.TreatmentLabTest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TreatmentLabTestRepository extends JpaRepository<TreatmentLabTest, UUID> {
    List<TreatmentLabTest> findByTreatmentPlanId(UUID treatmentPlanId);
    List<TreatmentLabTest> findByPatientIdOrderByDueDateAsc(UUID patientId);
    List<TreatmentLabTest> findByPatientIdAndStatus(UUID patientId, String status);
}
