package com.app.record.repository;

import com.app.record.entity.CareTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface CareTaskRepository extends JpaRepository<CareTask, UUID> {
    List<CareTask> findByPatientIdOrderByDueDateAsc(UUID patientId);
    List<CareTask> findByPatientIdAndDueDate(UUID patientId, LocalDate dueDate);
    List<CareTask> findByPatientIdAndDueDateBetweenOrderByDueDateAsc(UUID patientId, LocalDate start, LocalDate end);
    List<CareTask> findByPatientIdAndStatus(UUID patientId, String status);
    List<CareTask> findByTreatmentPlanId(UUID treatmentPlanId);

    @Query("SELECT COUNT(t) FROM CareTask t WHERE t.patientId = :patientId AND t.status = 'COMPLETED'")
    long countCompletedByPatientId(@Param("patientId") UUID patientId);

    @Query("SELECT COUNT(t) FROM CareTask t WHERE t.patientId = :patientId AND t.status = 'PENDING'")
    long countPendingByPatientId(@Param("patientId") UUID patientId);
}
