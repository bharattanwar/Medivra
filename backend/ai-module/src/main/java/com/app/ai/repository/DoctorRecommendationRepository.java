package com.app.ai.repository;

import com.app.ai.entity.DoctorRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DoctorRecommendationRepository extends JpaRepository<DoctorRecommendation, UUID> {
    List<DoctorRecommendation> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
}
