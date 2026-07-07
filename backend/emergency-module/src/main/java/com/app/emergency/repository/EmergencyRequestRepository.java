package com.app.emergency.repository;

import com.app.emergency.entity.EmergencyRequest;
import com.app.emergency.entity.EmergencyStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface EmergencyRequestRepository extends JpaRepository<EmergencyRequest, UUID> {

    List<EmergencyRequest> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    List<EmergencyRequest> findByStatusInOrderByCreatedAtAsc(List<EmergencyStatus> statuses);

    List<EmergencyRequest> findByAssignedHospitalIdAndStatusIn(UUID hospitalId, List<EmergencyStatus> statuses);

    @Query("SELECT e FROM EmergencyRequest e WHERE e.status IN ('PENDING', 'SEARCHING') " +
           "AND e.createdAt < :cutoff")
    List<EmergencyRequest> findStaleEmergencies(@Param("cutoff") LocalDateTime cutoff);

    long countByCreatedAtAfter(LocalDateTime since);
}
