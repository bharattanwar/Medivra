package com.app.record.repository;

import com.app.record.entity.MedicationDoseLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface MedicationDoseLogRepository extends JpaRepository<MedicationDoseLog, UUID> {
    List<MedicationDoseLog> findByPatientIdAndDoseDate(UUID patientId, LocalDate doseDate);
    List<MedicationDoseLog> findByPatientIdAndDoseDateBetweenOrderByDoseDateAsc(UUID patientId, LocalDate start, LocalDate end);
    List<MedicationDoseLog> findByTreatmentMedicationIdOrderByDoseDateAsc(UUID treatmentMedicationId);

    @Query("SELECT l.status, COUNT(l) FROM MedicationDoseLog l WHERE l.patientId = :patientId GROUP BY l.status")
    List<Object[]> countStatusByPatientId(@Param("patientId") UUID patientId);

    @Query("SELECT l.status, COUNT(l) FROM MedicationDoseLog l WHERE l.treatmentMedicationId IN :medicationIds GROUP BY l.status")
    List<Object[]> countStatusByMedicationIds(@Param("medicationIds") List<UUID> medicationIds);
}
