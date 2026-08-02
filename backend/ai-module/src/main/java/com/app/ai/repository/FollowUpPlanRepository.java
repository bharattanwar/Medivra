package com.app.ai.repository;

import com.app.ai.entity.FollowUpPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FollowUpPlanRepository extends JpaRepository<FollowUpPlan, UUID> {
    List<FollowUpPlan> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
    List<FollowUpPlan> findByStatus(String status);
}
