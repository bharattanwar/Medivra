package com.app.ai.repository;

import com.app.ai.entity.FollowUpCheckIn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FollowUpCheckInRepository extends JpaRepository<FollowUpCheckIn, UUID> {
    List<FollowUpCheckIn> findByFollowUpPlanIdOrderByDayNumberAsc(UUID followUpPlanId);
}
