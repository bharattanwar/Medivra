package com.app.emergency.service;

import com.app.emergency.dto.AmbulanceLocationUpdate;
import com.app.emergency.dto.NearbyAmbulanceResponse;
import com.app.emergency.entity.Ambulance;
import com.app.emergency.entity.EmergencyRequest;
import com.app.emergency.entity.EmergencyStatus;
import com.app.emergency.entity.EmergencyTimeline;
import com.app.emergency.entity.EmergencyTimelineEvent;
import com.app.emergency.repository.AmbulanceDriverRepository;
import com.app.emergency.repository.AmbulanceRepository;
import com.app.emergency.repository.EmergencyRequestRepository;
import com.app.emergency.repository.EmergencyTimelineRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Service managing real-time ambulance dispatching, concurrency control for driver acceptance,
 * live GPS tracking telemetry, and trip milestone updates.
 *
 * Capabilities:
 * - dispatchNearbyAmbulances: Async broadcast to nearest available ambulance candidates within search radius.
 * - acceptEmergency: Optimistic concurrency lock ensures the first driver to accept secures the ride.
 * - updateAmbulanceLocation: Broadcasts live GPS telemetry and dynamically updated ETA to subscribed channels.
 * - updateTripStatus: Tracks transit transitions (EN_ROUTE -> ARRIVED_AT_PATIENT -> TRANSPORTING -> ARRIVED_AT_HOSPITAL -> COMPLETED).
 */
@Service
public class AmbulanceDispatchService {

    private static final Logger log = LoggerFactory.getLogger(AmbulanceDispatchService.class);
    private static final int MAX_DISPATCH_CANDIDATES = 5;
    // Average urban ambulance transit speed in km/h
    private static final double AVG_SPEED_KMH = 40.0;

    private final AmbulanceRepository ambulanceRepository;
    private final AmbulanceDriverRepository driverRepository;
    private final EmergencyRequestRepository emergencyRequestRepository;
    private final EmergencyTimelineRepository timelineRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final EmergencyNotificationService notificationService;

    public AmbulanceDispatchService(AmbulanceRepository ambulanceRepository,
                                    AmbulanceDriverRepository driverRepository,
                                    EmergencyRequestRepository emergencyRequestRepository,
                                    EmergencyTimelineRepository timelineRepository,
                                    SimpMessagingTemplate messagingTemplate,
                                    EmergencyNotificationService notificationService) {
        this.ambulanceRepository = ambulanceRepository;
        this.driverRepository = driverRepository;
        this.emergencyRequestRepository = emergencyRequestRepository;
        this.timelineRepository = timelineRepository;
        this.messagingTemplate = messagingTemplate;
        this.notificationService = notificationService;
    }

    /**
     * Finds candidate ambulances near patient and sends WebSocket dispatch alerts to drivers.
     */
    @Async
    public void dispatchNearbyAmbulances(EmergencyRequest emergency) {
        List<Ambulance> candidates = ambulanceRepository.findNearbyAvailableAmbulances(
                emergency.getPatientLat(),
                emergency.getPatientLng(),
                emergency.getSearchRadiusKm(),
                MAX_DISPATCH_CANDIDATES);

        if (candidates.isEmpty()) {
            log.warn("No available ambulances found within {}km for emergency {}", emergency.getSearchRadiusKm(), emergency.getId());
            return;
        }

        log.info("Dispatching to {} ambulance candidates for emergency {}", candidates.size(), emergency.getId());

        for (Ambulance ambulance : candidates) {
            NearbyAmbulanceResponse dispatchPayload = buildDispatchPayload(ambulance, emergency);
            if (ambulance.getDriverId() != null) {
                messagingTemplate.convertAndSendToUser(
                        ambulance.getDriverId().toString(),
                        "/queue/ambulance-dispatch",
                        dispatchPayload);
            }
        }

        recordTimeline(emergency.getId(), EmergencyTimelineEvent.AMBULANCE_FOUND,
                candidates.size() + " ambulance(s) notified");
    }

    /**
     * Driver acceptance handler using JPA @Version optimistic locking on EmergencyRequest.
     * Throws exception if another driver accepted concurrently.
     */
    @Transactional
    public EmergencyRequest acceptEmergency(UUID emergencyId, UUID ambulanceId) {
        EmergencyRequest emergency = emergencyRequestRepository.findById(emergencyId)
                .orElseThrow(() -> new RuntimeException("Emergency not found"));

        if (emergency.getStatus() != EmergencyStatus.SEARCHING &&
                emergency.getStatus() != EmergencyStatus.PENDING) {
            throw new RuntimeException("Emergency already assigned or closed");
        }

        Ambulance ambulance = ambulanceRepository.findById(ambulanceId)
                .orElseThrow(() -> new RuntimeException("Ambulance not found"));

        if (!ambulance.getIsAvailable() || !ambulance.getIsOnline()) {
            throw new RuntimeException("Ambulance is not available");
        }

        double distanceKm = haversineDistance(
                emergency.getPatientLat(), emergency.getPatientLng(),
                ambulance.getCurrentLat(), ambulance.getCurrentLng());
        int etaMinutes = (int) Math.ceil((distanceKm / AVG_SPEED_KMH) * 60);

        try {
            emergency.setAssignedAmbulanceId(ambulanceId);
            emergency.setStatus(EmergencyStatus.AMBULANCE_ASSIGNED);
            emergency.setEstimatedArrivalMinutes(etaMinutes);
            emergency = emergencyRequestRepository.save(emergency);
        } catch (ObjectOptimisticLockingFailureException e) {
            throw new RuntimeException("Another ambulance already accepted this emergency");
        }

        ambulance.setIsAvailable(false);
        ambulanceRepository.save(ambulance);

        recordTimeline(emergencyId, EmergencyTimelineEvent.DRIVER_ACCEPTED,
                "Ambulance " + ambulance.getVehicleNumber() + " accepted. ETA: " + etaMinutes + " min");
        recordTimeline(emergencyId, EmergencyTimelineEvent.DRIVER_EN_ROUTE, "Ambulance en route to patient");

        notificationService.broadcastStatusUpdate(emergency);
        return emergency;
    }

    /**
     * Updates an ambulance's current GPS coordinates and broadcasts ETA updates to active subscriptions.
     */
    @Transactional
    public void updateAmbulanceLocation(UUID ambulanceId, double lat, double lng) {
        Optional<Ambulance> ambulanceOpt = ambulanceRepository.findById(ambulanceId);
        if (ambulanceOpt.isEmpty()) return;

        Ambulance ambulance = ambulanceOpt.get();
        ambulance.setCurrentLat(lat);
        ambulance.setCurrentLng(lng);
        ambulance.setLastLocationUpdate(LocalDateTime.now());
        ambulanceRepository.save(ambulance);

        emergencyRequestRepository.findByStatusInOrderByCreatedAtAsc(
                List.of(EmergencyStatus.AMBULANCE_ASSIGNED, EmergencyStatus.EN_ROUTE,
                        EmergencyStatus.ARRIVED_AT_PATIENT, EmergencyStatus.TRANSPORTING))
                .stream()
                .filter(e -> ambulanceId.equals(e.getAssignedAmbulanceId()))
                .findFirst()
                .ifPresent(emergency -> {
                    double distKm = haversineDistance(
                            emergency.getPatientLat(), emergency.getPatientLng(), lat, lng);
                    int etaMin = (int) Math.ceil((distKm / AVG_SPEED_KMH) * 60);

                    AmbulanceLocationUpdate update = new AmbulanceLocationUpdate(
                            ambulanceId, emergency.getId(), lat, lng, LocalDateTime.now(), etaMin);

                    messagingTemplate.convertAndSend(
                            "/topic/emergency/" + emergency.getId(), update);
                });
    }

    /**
     * Advances emergency trip status through lifecycle milestones and releases fleet when completed.
     */
    @Transactional
    public EmergencyRequest updateTripStatus(UUID emergencyId, UUID ambulanceId, EmergencyStatus newStatus, String notes) {
        EmergencyRequest emergency = emergencyRequestRepository.findById(emergencyId)
                .orElseThrow(() -> new RuntimeException("Emergency not found"));

        if (!ambulanceId.equals(emergency.getAssignedAmbulanceId())) {
            throw new RuntimeException("Not the assigned ambulance for this emergency");
        }

        emergency.setStatus(newStatus);
        emergency = emergencyRequestRepository.save(emergency);

        EmergencyTimelineEvent event = mapStatusToTimelineEvent(newStatus);
        if (event != null) {
            recordTimeline(emergencyId, event, notes != null ? notes : event.name().replace("_", " "));
        }

        if (newStatus == EmergencyStatus.COMPLETED || newStatus == EmergencyStatus.ARRIVED_AT_HOSPITAL) {
            ambulanceRepository.findById(ambulanceId).ifPresent(amb -> {
                amb.setIsAvailable(true);
                ambulanceRepository.save(amb);
            });
            if (newStatus == EmergencyStatus.ARRIVED_AT_HOSPITAL) {
                recordTimeline(emergencyId, EmergencyTimelineEvent.HOSPITAL_ARRIVED, "Patient delivered to hospital");
            }
        }

        notificationService.broadcastStatusUpdate(emergency);
        return emergency;
    }

    private NearbyAmbulanceResponse buildDispatchPayload(Ambulance ambulance, EmergencyRequest emergency) {
        NearbyAmbulanceResponse payload = new NearbyAmbulanceResponse();
        payload.setAmbulanceId(ambulance.getId());
        payload.setVehicleNumber(ambulance.getVehicleNumber());
        payload.setAmbulanceType(ambulance.getAmbulanceType().name());
        payload.setDriverLat(ambulance.getCurrentLat());
        payload.setDriverLng(ambulance.getCurrentLng());

        if (ambulance.getCurrentLat() != null && ambulance.getCurrentLng() != null) {
            double dist = haversineDistance(
                    emergency.getPatientLat(), emergency.getPatientLng(),
                    ambulance.getCurrentLat(), ambulance.getCurrentLng());
            payload.setDistanceKm(Math.round(dist * 10.0) / 10.0);
            payload.setEstimatedMinutes((int) Math.ceil((dist / AVG_SPEED_KMH) * 60));
        }

        if (ambulance.getDriverId() != null) {
            driverRepository.findById(ambulance.getDriverId()).ifPresent(driver -> {
                payload.setDriverId(driver.getId());
                payload.setDriverName(driver.getFullName());
                payload.setDriverPhone(driver.getPhone());
            });
        }

        return payload;
    }

    private void recordTimeline(UUID emergencyId, EmergencyTimelineEvent event, String description) {
        EmergencyTimeline entry = new EmergencyTimeline();
        entry.setEmergencyId(emergencyId);
        entry.setEvent(event);
        entry.setDescription(description);
        entry.setEventTimestamp(LocalDateTime.now());
        timelineRepository.save(entry);
    }

    private EmergencyTimelineEvent mapStatusToTimelineEvent(EmergencyStatus status) {
        return switch (status) {
            case EN_ROUTE -> EmergencyTimelineEvent.DRIVER_EN_ROUTE;
            case ARRIVED_AT_PATIENT -> EmergencyTimelineEvent.DRIVER_ARRIVED;
            case TRANSPORTING -> EmergencyTimelineEvent.PATIENT_PICKED_UP;
            case ARRIVED_AT_HOSPITAL -> EmergencyTimelineEvent.EN_ROUTE_TO_HOSPITAL;
            case COMPLETED -> EmergencyTimelineEvent.EMERGENCY_CLOSED;
            default -> null;
        };
    }

    public static double haversineDistance(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
