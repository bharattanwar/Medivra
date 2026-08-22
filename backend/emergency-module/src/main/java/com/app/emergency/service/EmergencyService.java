package com.app.emergency.service;

import com.app.emergency.dto.EmergencyContactRequest;
import com.app.emergency.dto.EmergencyResponse;
import com.app.emergency.dto.SosRequest;
import com.app.emergency.entity.EmergencyContact;
import com.app.emergency.entity.EmergencyRequest;
import com.app.emergency.entity.EmergencyStatus;
import com.app.emergency.entity.EmergencyTimeline;
import com.app.emergency.entity.EmergencyTimelineEvent;
import com.app.emergency.repository.AmbulanceDriverRepository;
import com.app.emergency.repository.AmbulanceRepository;
import com.app.emergency.repository.EmergencyContactRepository;
import com.app.emergency.repository.EmergencyRequestRepository;
import com.app.emergency.repository.EmergencyTimelineRepository;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service managing emergency SOS activations, timeline state tracking,
 * emergency contact notifications, and patient SOS history.
 *
 * Workflow:
 * 1. createEmergency: Initializes SOS request with SEARCHING status, records initial timeline,
 *    alerts registered emergency contacts, and triggers async ambulance dispatch.
 * 2. cancelEmergency: Aborts SOS activation, releases any assigned ambulance, and notifies parties.
 * 3. getEmergencyStatus: Retrieves real-time status, driver details, live location, and timeline entries.
 */
@Service
public class EmergencyService {

    private final EmergencyRequestRepository emergencyRequestRepository;
    private final EmergencyTimelineRepository timelineRepository;
    private final EmergencyContactRepository contactRepository;
    private final AmbulanceRepository ambulanceRepository;
    private final AmbulanceDriverRepository driverRepository;
    private final UserRepository userRepository;
    private final AmbulanceDispatchService dispatchService;
    private final EmergencyNotificationService notificationService;

    public EmergencyService(EmergencyRequestRepository emergencyRequestRepository,
                            EmergencyTimelineRepository timelineRepository,
                            EmergencyContactRepository contactRepository,
                            AmbulanceRepository ambulanceRepository,
                            AmbulanceDriverRepository driverRepository,
                            UserRepository userRepository,
                            AmbulanceDispatchService dispatchService,
                            EmergencyNotificationService notificationService) {
        this.emergencyRequestRepository = emergencyRequestRepository;
        this.timelineRepository = timelineRepository;
        this.contactRepository = contactRepository;
        this.ambulanceRepository = ambulanceRepository;
        this.driverRepository = driverRepository;
        this.userRepository = userRepository;
        this.dispatchService = dispatchService;
        this.notificationService = notificationService;
    }

    /**
     * Activates an emergency SOS, records timeline events, triggers emergency contact alerts,
     * and requests ambulance dispatch within initial search radius.
     */
    @Transactional
    public EmergencyResponse createEmergency(SosRequest request, UUID patientId) {
        EmergencyRequest emergency = new EmergencyRequest();
        emergency.setPatientId(patientId);
        emergency.setPatientLat(request.getLat());
        emergency.setPatientLng(request.getLng());
        emergency.setPatientAddress(request.getPatientAddress());
        emergency.setEmergencyType(request.getEmergencyType());
        emergency.setStatus(EmergencyStatus.SEARCHING);
        emergency.setNotes(request.getNotes());
        emergency = emergencyRequestRepository.save(emergency);

        // Record initial milestone events
        recordTimeline(emergency.getId(), EmergencyTimelineEvent.SOS_CREATED, "Emergency SOS activated by patient");
        recordTimeline(emergency.getId(), EmergencyTimelineEvent.SEARCH_STARTED,
                "Searching for nearby ambulances within " + emergency.getSearchRadiusKm() + " km");

        // Notify emergency contacts immediately
        List<EmergencyContact> contacts = contactRepository.findByPatientId(patientId);
        User patient = userRepository.findById(patientId).orElse(null);
        String patientName = patient != null ? patient.getFullName() : "A patient";
        notificationService.notifyEmergencyContacts(contacts, emergency, patientName);

        // Dispatch ambulances asynchronously
        dispatchService.dispatchNearbyAmbulances(emergency);

        return buildResponse(emergency, patient);
    }

    /**
     * Retrieves current emergency status including assigned ambulance and full timeline events.
     */
    @Transactional(readOnly = true)
    public EmergencyResponse getEmergencyStatus(UUID emergencyId, UUID requesterId) {
        EmergencyRequest emergency = emergencyRequestRepository.findById(emergencyId)
                .orElseThrow(() -> new RuntimeException("Emergency not found: " + emergencyId));

        User patient = userRepository.findById(emergency.getPatientId()).orElse(null);
        return buildResponse(emergency, patient);
    }

    /**
     * Cancels an active emergency, releases reserved ambulance fleet, and broadcasts cancellation.
     */
    @Transactional
    public EmergencyResponse cancelEmergency(UUID emergencyId, UUID patientId) {
        EmergencyRequest emergency = emergencyRequestRepository.findById(emergencyId)
                .orElseThrow(() -> new RuntimeException("Emergency not found: " + emergencyId));

        if (!emergency.getPatientId().equals(patientId)) {
            throw new RuntimeException("Unauthorized to cancel this emergency");
        }

        emergency.setStatus(EmergencyStatus.CANCELLED);
        emergencyRequestRepository.save(emergency);

        // Free up assigned ambulance
        if (emergency.getAssignedAmbulanceId() != null) {
            ambulanceRepository.findById(emergency.getAssignedAmbulanceId()).ifPresent(amb -> {
                amb.setIsAvailable(true);
                ambulanceRepository.save(amb);
            });
        }

        recordTimeline(emergencyId, EmergencyTimelineEvent.CANCELLED, "Emergency cancelled by patient");
        notificationService.broadcastStatusUpdate(emergency);

        User patient = userRepository.findById(patientId).orElse(null);
        return buildResponse(emergency, patient);
    }

    @Transactional(readOnly = true)
    public List<EmergencyResponse> getPatientHistory(UUID patientId) {
        return emergencyRequestRepository.findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .map(e -> buildResponse(e, null))
                .collect(Collectors.toList());
    }

    // ── Emergency Contact Management ──────────────────────────────────────────

    @Transactional
    public EmergencyContact addEmergencyContact(EmergencyContactRequest request, UUID patientId) {
        EmergencyContact contact = new EmergencyContact();
        contact.setPatientId(patientId);
        contact.setName(request.getName());
        contact.setPhone(request.getPhone());
        contact.setEmail(request.getEmail());
        contact.setRelationship(request.getRelationship());
        return contactRepository.save(contact);
    }

    @Transactional(readOnly = true)
    public List<EmergencyContact> getEmergencyContacts(UUID patientId) {
        return contactRepository.findByPatientId(patientId);
    }

    @Transactional
    public void deleteEmergencyContact(UUID contactId, UUID patientId) {
        contactRepository.deleteByIdAndPatientId(contactId, patientId);
    }

    /**
     * Appends an audit milestone to the emergency timeline.
     */
    public void recordTimeline(UUID emergencyId, EmergencyTimelineEvent event, String description) {
        EmergencyTimeline entry = new EmergencyTimeline();
        entry.setEmergencyId(emergencyId);
        entry.setEvent(event);
        entry.setDescription(description);
        entry.setEventTimestamp(LocalDateTime.now());
        timelineRepository.save(entry);
    }

    private EmergencyResponse buildResponse(EmergencyRequest emergency, User patient) {
        EmergencyResponse response = new EmergencyResponse();
        response.setId(emergency.getId());
        response.setPatientId(emergency.getPatientId());
        response.setPatientName(patient != null ? patient.getFullName() : null);
        response.setPatientLat(emergency.getPatientLat());
        response.setPatientLng(emergency.getPatientLng());
        response.setPatientAddress(emergency.getPatientAddress());
        response.setEmergencyType(emergency.getEmergencyType());
        response.setStatus(emergency.getStatus());
        response.setEstimatedArrivalMinutes(emergency.getEstimatedArrivalMinutes());
        response.setEscalationCount(emergency.getEscalationCount());
        response.setCreatedAt(emergency.getCreatedAt());
        response.setAssignedAmbulanceId(emergency.getAssignedAmbulanceId());

        // Enrich vehicle and driver details if assigned
        if (emergency.getAssignedAmbulanceId() != null) {
            ambulanceRepository.findById(emergency.getAssignedAmbulanceId()).ifPresent(amb -> {
                response.setVehicleNumber(amb.getVehicleNumber());
                response.setAmbulanceType(amb.getAmbulanceType().name());
                response.setAmbulanceLat(amb.getCurrentLat());
                response.setAmbulanceLng(amb.getCurrentLng());

                if (amb.getDriverId() != null) {
                    driverRepository.findById(amb.getDriverId()).ifPresent(driver -> {
                        response.setDriverName(driver.getFullName());
                        response.setDriverPhone(driver.getPhone());
                    });
                }
            });
        }

        // Chronological timeline events
        List<EmergencyResponse.TimelineEntryDto> timeline = timelineRepository
                .findByEmergencyIdOrderByEventTimestampAsc(emergency.getId())
                .stream()
                .map(t -> {
                    EmergencyResponse.TimelineEntryDto dto = new EmergencyResponse.TimelineEntryDto();
                    dto.setEvent(t.getEvent().name());
                    dto.setDescription(t.getDescription());
                    dto.setTimestamp(t.getEventTimestamp());
                    return dto;
                })
                .collect(Collectors.toList());
        response.setTimeline(timeline);

        return response;
    }
}
