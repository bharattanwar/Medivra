package com.app.record.service;

import com.app.record.dto.IngestLabParametersRequest;
import com.app.record.dto.LabTrendResponse;
import com.app.record.entity.CareTask;
import com.app.record.entity.LabReportParameter;
import com.app.record.entity.TreatmentLabTest;
import com.app.record.repository.CareTaskRepository;
import com.app.record.repository.LabReportParameterRepository;
import com.app.record.repository.TreatmentLabTestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DeterministicLabService {

    private static final Logger log = LoggerFactory.getLogger(DeterministicLabService.class);

    private final LabReportParameterRepository parameterRepository;
    private final TreatmentLabTestRepository treatmentLabTestRepository;
    private final CareTaskRepository careTaskRepository;

    public DeterministicLabService(LabReportParameterRepository parameterRepository,
                                  TreatmentLabTestRepository treatmentLabTestRepository,
                                  CareTaskRepository careTaskRepository) {
        this.parameterRepository = parameterRepository;
        this.treatmentLabTestRepository = treatmentLabTestRepository;
        this.careTaskRepository = careTaskRepository;
    }

    /**
     * Ingests structured lab test parameters and automatically marks matching lab test / report care tasks as completed.
     */
    @Transactional
    public List<LabReportParameter> ingestParameters(IngestLabParametersRequest request) {
        log.info("Ingesting {} structured parameters for patient {}",
                request.getParameters() != null ? request.getParameters().size() : 0, request.getPatientId());

        if (request.getParameters() == null || request.getParameters().isEmpty()) {
            return Collections.emptyList();
        }

        LocalDate testDate = request.getTestDate() != null ? request.getTestDate() : LocalDate.now();
        List<LabReportParameter> savedList = new ArrayList<>();

        for (IngestLabParametersRequest.LabParameterInput p : request.getParameters()) {
            if (p.getParameterName() == null || p.getParameterName().isBlank()) continue;

            LabReportParameter param = new LabReportParameter();
            param.setReportId(request.getReportId());
            param.setPatientId(request.getPatientId());
            param.setTestCategory(request.getTestCategory());
            param.setParameterName(p.getParameterName().trim());
            param.setNumericValue(p.getNumericValue() != null ? p.getNumericValue() : parseDoubleSafe(p.getRawValue()));
            param.setRawValue(p.getRawValue() != null ? p.getRawValue() : String.valueOf(p.getNumericValue()));
            param.setUnit(p.getUnit());
            param.setReferenceRangeMin(p.getReferenceRangeMin());
            param.setReferenceRangeMax(p.getReferenceRangeMax());
            param.setReferenceRangeText(p.getReferenceRangeText());
            param.setFlag(p.getFlag() != null ? p.getFlag() : determineFlag(param.getNumericValue(), param.getReferenceRangeMin(), param.getReferenceRangeMax()));
            param.setTestDate(testDate);

            savedList.add(parameterRepository.save(param));
        }

        // Fulfill pending TreatmentLabTest and linked care tasks ONLY if explicitly requested via Health Journey
        if (Boolean.TRUE.equals(request.getIsHealthJourneyFulfillment())) {
            log.info("Explicit Health Journey fulfillment triggered for report {}", request.getReportId());
            if (request.getLinkedLabTestId() != null) {
                treatmentLabTestRepository.findById(request.getLinkedLabTestId()).ifPresent(plt -> {
                    plt.setStatus("COMPLETED");
                    plt.setReportId(request.getReportId());
                    treatmentLabTestRepository.save(plt);

                    // Mark linked care tasks as completed
                    List<CareTask> tasks = careTaskRepository.findByPatientIdOrderByDueDateAsc(request.getPatientId())
                            .stream().filter(t -> plt.getId().equals(t.getReferenceId()) && !"COMPLETED".equals(t.getStatus()))
                            .collect(Collectors.toList());
                    for (CareTask t : tasks) {
                        t.setStatus("COMPLETED");
                        t.setCompletedAt(LocalDateTime.now());
                        careTaskRepository.save(t);
                    }
                });
            } else {
                List<TreatmentLabTest> pendingTests = treatmentLabTestRepository.findByPatientIdAndStatus(request.getPatientId(), "PENDING");
                for (TreatmentLabTest plt : pendingTests) {
                    boolean matches = savedList.stream().anyMatch(sp ->
                            sp.getParameterName().equalsIgnoreCase(plt.getTestName()) ||
                            sp.getParameterName().toLowerCase().contains(plt.getTestName().toLowerCase()) ||
                            (request.getTestCategory() != null && request.getTestCategory().toLowerCase().contains(plt.getTestName().toLowerCase())));

                    if (matches) {
                        plt.setStatus("COMPLETED");
                        plt.setReportId(request.getReportId());
                        treatmentLabTestRepository.save(plt);

                        // Mark linked care tasks as completed
                        List<CareTask> tasks = careTaskRepository.findByPatientIdOrderByDueDateAsc(request.getPatientId())
                                .stream().filter(t -> plt.getId().equals(t.getReferenceId()) && !"COMPLETED".equals(t.getStatus()))
                                .collect(Collectors.toList());
                        for (CareTask t : tasks) {
                            t.setStatus("COMPLETED");
                            t.setCompletedAt(LocalDateTime.now());
                            careTaskRepository.save(t);
                        }
                    }
                }
            }
        }

        return savedList;
    }

    /**
     * Deterministically calculates historical trends and comparisons for all parameters of a patient.
     * Pure Java math & comparison logic — NO probabilistic guessing.
     */
    @Transactional(readOnly = true)
    public List<LabTrendResponse> getLabTrendsForPatient(UUID patientId) {
        List<String> distinctParams = parameterRepository.findDistinctParameterNamesByPatientId(patientId);
        List<LabTrendResponse> trends = new ArrayList<>();

        for (String paramName : distinctParams) {
            List<LabReportParameter> readings = parameterRepository.findByPatientIdAndParameterNameOrderByTestDateAsc(patientId, paramName);
            if (readings.isEmpty()) continue;

            LabTrendResponse trend = new LabTrendResponse();
            LabReportParameter latest = readings.get(readings.size() - 1);
            trend.setReportId(latest.getReportId());
            trend.setParameterName(paramName);
            trend.setTestCategory(latest.getTestCategory() != null && !latest.getTestCategory().isBlank() ? latest.getTestCategory() : "General Lab Panel");
            trend.setUnit(latest.getUnit());
            trend.setReferenceRangeMin(latest.getReferenceRangeMin());
            trend.setReferenceRangeMax(latest.getReferenceRangeMax());
            trend.setReferenceRangeText(latest.getReferenceRangeText());

            // Latest reading
            trend.setLatestValue(latest.getNumericValue());
            trend.setLatestRawValue(latest.getRawValue());
            trend.setLatestFlag(latest.getFlag());
            trend.setLatestDate(latest.getTestDate());

            // Previous reading (if available)
            if (readings.size() > 1) {
                LabReportParameter prev = readings.get(readings.size() - 2);
                trend.setPreviousValue(prev.getNumericValue());
                trend.setPreviousRawValue(prev.getRawValue());
                trend.setPreviousFlag(prev.getFlag());
                trend.setPreviousDate(prev.getTestDate());

                // Deterministic calculation
                if (latest.getNumericValue() != null && prev.getNumericValue() != null) {
                    double delta = latest.getNumericValue() - prev.getNumericValue();
                    double roundedDelta = Math.round(delta * 100.0) / 100.0;
                    trend.setDeltaNumeric(roundedDelta);

                    if (prev.getNumericValue() != 0) {
                        double pct = (delta / prev.getNumericValue()) * 100.0;
                        trend.setDeltaPercentage(Math.round(pct * 10.0) / 10.0);
                    } else {
                        trend.setDeltaPercentage(0.0);
                    }

                    // Determine trend direction
                    if (Math.abs(delta) < 0.001) {
                        trend.setTrendDirection("STABLE");
                    } else if (delta > 0) {
                        trend.setTrendDirection("INCREASED");
                    } else {
                        trend.setTrendDirection("DECREASED");
                    }

                    // Status transition (e.g. "HIGH -> NORMAL" or "NORMAL -> NORMAL")
                    trend.setStatusTransition(prev.getFlag() + " \u2192 " + latest.getFlag());
                }
            } else {
                trend.setTrendDirection("INITIAL_BASELINE");
                trend.setStatusTransition(latest.getFlag());
            }

            // History readings list
            List<LabTrendResponse.LabParameterReadingDto> histDtos = readings.stream().map(r ->
                    new LabTrendResponse.LabParameterReadingDto(
                            r.getId(),
                            r.getReportId(),
                            r.getNumericValue(),
                            r.getRawValue(),
                            r.getFlag(),
                            r.getTestDate()
                    )
            ).collect(Collectors.toList());
            trend.setHistory(histDtos);

            trends.add(trend);
        }

        return trends;
    }

    private String determineFlag(Double value, Double min, Double max) {
        if (value == null) return "NORMAL";
        if (min != null && value < min) return "LOW";
        if (max != null && value > max) return "HIGH";
        return "NORMAL";
    }

    private Double parseDoubleSafe(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            String digits = raw.replaceAll("[^0-9.]", "").trim();
            if (!digits.isEmpty()) {
                return Double.parseDouble(digits);
            }
        } catch (Exception e) {
            log.debug("Unable to parse numeric from raw value: {}", raw);
        }
        return null;
    }
}
