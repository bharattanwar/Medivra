package com.app.ai.repository;

import com.app.ai.entity.AiReportSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AiReportSummaryRepository extends JpaRepository<AiReportSummary, UUID> {
    Optional<AiReportSummary> findByReportId(UUID reportId);
}
