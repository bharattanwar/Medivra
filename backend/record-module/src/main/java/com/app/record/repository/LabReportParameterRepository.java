package com.app.record.repository;

import com.app.record.entity.LabReportParameter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LabReportParameterRepository extends JpaRepository<LabReportParameter, UUID> {
    List<LabReportParameter> findByPatientIdOrderByTestDateDesc(UUID patientId);
    List<LabReportParameter> findByReportId(UUID reportId);
    List<LabReportParameter> findByPatientIdAndParameterNameOrderByTestDateAsc(UUID patientId, String parameterName);

    @Query("SELECT DISTINCT p.parameterName FROM LabReportParameter p WHERE p.patientId = :patientId")
    List<String> findDistinctParameterNamesByPatientId(@Param("patientId") UUID patientId);
}
