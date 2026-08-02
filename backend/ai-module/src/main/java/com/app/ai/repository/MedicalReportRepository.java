package com.app.ai.repository;

import com.app.ai.entity.MedicalReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MedicalReportRepository extends JpaRepository<MedicalReport, UUID> {
    List<MedicalReport> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
}
