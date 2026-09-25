package com.app.record.repository;

import com.app.record.entity.TreatmentPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TreatmentPlanRepository extends JpaRepository<TreatmentPlan, UUID> {
    List<TreatmentPlan> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
    Optional<TreatmentPlan> findFirstByPatientIdAndStatusOrderByCreatedAtDesc(UUID patientId, String status);
    List<TreatmentPlan> findByDoctorIdOrderByCreatedAtDesc(UUID doctorId);
    Optional<TreatmentPlan> findByAppointmentId(UUID appointmentId);
    Optional<TreatmentPlan> findByMedicalRecordId(UUID medicalRecordId);
}
