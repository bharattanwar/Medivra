package com.app.emergency.repository;

import com.app.emergency.entity.EmergencyTimeline;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EmergencyTimelineRepository extends JpaRepository<EmergencyTimeline, UUID> {

    List<EmergencyTimeline> findByEmergencyIdOrderByEventTimestampAsc(UUID emergencyId);
}
