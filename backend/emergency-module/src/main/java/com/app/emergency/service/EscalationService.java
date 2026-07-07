package com.app.emergency.service;

import com.app.emergency.entity.*;
import com.app.emergency.repository.*;
import com.app.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class EscalationService {

    private static final Logger log = LoggerFactory.getLogger(EscalationService.class);
    private static final double ESCALATION_RADIUS_INCREMENT_KM = 5.0;
    private static final int MAX_ESCALATIONS = 4;
    private static final int TIMEOUT_MINUTES = 2;

    private final EmergencyRequestRepository emergencyRequestRepository;
    private final EmergencyContactRepository contactRepository;
    private final EmergencyTimelineRepository timelineRepository;
    private final UserRepository userRepository;
    private final AmbulanceDispatchService dispatchService;
    private final EmergencyNotificationService notificationService;

    public EscalationService(
            EmergencyRequestRepository emergencyRequestRepository,
            EmergencyContactRepository contactRepository,
            EmergencyTimelineRepository timelineRepository,
            UserRepository userRepository,
            AmbulanceDispatchService dispatchService,
            EmergencyNotificationService notificationService) {
        this.emergencyRequestRepository = emergencyRequestRepository;
        this.contactRepository = contactRepository;
        this.timelineRepository = timelineRepository;
        this.userRepository = userRepository;
        this.dispatchService = dispatchService;
        this.notificationService = notificationService;
    }

    /**
     * Runs every 30 seconds to check for unaccepted emergencies and escalate them.
     */
    @Scheduled(fixedDelay = 30_000)
    @Transactional
    public void checkAndEscalate() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(TIMEOUT_MINUTES);
        List<EmergencyRequest> stale = emergencyRequestRepository.findStaleEmergencies(cutoff);

        for (EmergencyRequest emergency : stale) {
            if (emergency.getEscalationCount() >= MAX_ESCALATIONS) {
                // Max escalations reached — mark as escalated and advise calling 112
                emergency.setStatus(EmergencyStatus.ESCALATED);
                emergencyRequestRepository.save(emergency);

                recordTimeline(emergency.getId(), EmergencyTimelineEvent.ESCALATED,
                        "No ambulance available. Please call 112 (National Emergency).");

                List<EmergencyContact> contacts = contactRepository.findByPatientId(emergency.getPatientId());
                userRepository.findById(emergency.getPatientId()).ifPresent(patient ->
                        notificationService.notifyEscalationToContacts(contacts, emergency, patient.getFullName())
                );
                notificationService.broadcastStatusUpdate(emergency);
                log.warn("Emergency {} escalated to max level, advising manual call", emergency.getId());
            } else {
                // Expand radius and re-dispatch
                double newRadius = emergency.getSearchRadiusKm() + ESCALATION_RADIUS_INCREMENT_KM;
                emergency.setSearchRadiusKm(newRadius);
                emergency.setEscalationCount(emergency.getEscalationCount() + 1);
                emergencyRequestRepository.save(emergency);

                recordTimeline(emergency.getId(), EmergencyTimelineEvent.ESCALATED,
                        "No response. Expanding search radius to " + newRadius + " km (attempt " + emergency.getEscalationCount() + ")");

                dispatchService.dispatchNearbyAmbulances(emergency);
                notificationService.broadcastStatusUpdate(emergency);
                log.info("Escalated emergency {} — new radius {}km", emergency.getId(), newRadius);
            }
        }
    }

    private void recordTimeline(java.util.UUID emergencyId, EmergencyTimelineEvent event, String description) {
        EmergencyTimeline entry = new EmergencyTimeline();
        entry.setEmergencyId(emergencyId);
        entry.setEvent(event);
        entry.setDescription(description);
        entry.setEventTimestamp(LocalDateTime.now());
        timelineRepository.save(entry);
    }
}
