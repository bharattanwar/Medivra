package com.app.chat.controller;

import com.app.appointment.entity.Appointment;
import com.app.appointment.repository.AppointmentRepository;
import com.app.chat.dto.VideoSignalMessage;
import com.app.common.entity.NotificationType;
import com.app.common.event.NotificationEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;

import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Controller handling WebRTC video signaling and waiting notifications over WebSocket STOMP.
 *
 * Forwards JOIN, OFFER, ANSWER, CANDIDATE, and LEAVE signal payloads between
 * patient and doctor connected in a consultation room, and broadcasts a single call waiting
 * notification alert to the other party only when a participant is waiting alone in the room.
 */
@Controller
public class VideoSignalingController {

    private static final Logger log = LoggerFactory.getLogger(VideoSignalingController.class);

    private final SimpMessagingTemplate messagingTemplate;
    private final AppointmentRepository appointmentRepository;
    private final ApplicationEventPublisher eventPublisher;

    // Track active participants present in each consultation room: appointmentId -> Set of senderEmails
    private final Map<UUID, Set<String>> activeRoomParticipants = new ConcurrentHashMap<>();

    // Debounce/Cooldown map to ensure at most 1 waiting notification per appointment within 60 seconds
    private final Map<UUID, Long> lastWaitingNotificationTime = new ConcurrentHashMap<>();

    public VideoSignalingController(SimpMessagingTemplate messagingTemplate,
                                    AppointmentRepository appointmentRepository,
                                    ApplicationEventPublisher eventPublisher) {
        this.messagingTemplate = messagingTemplate;
        this.appointmentRepository = appointmentRepository;
        this.eventPublisher = eventPublisher;
    }

    @MessageMapping("/video.signal")
    public void handleVideoSignal(@Payload VideoSignalMessage message, Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserDetails)) {
            log.warn("Unauthenticated video signal received");
            return;
        }

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        String senderEmail = userDetails.getUsername();

        try {
            UUID appointmentId = UUID.fromString(message.getAppointmentId());
            // Use JOIN FETCH query to eagerly load patient, doctor, and doctor's user
            Optional<Appointment> appointmentOpt = appointmentRepository.findByIdWithParties(appointmentId);

            if (appointmentOpt.isEmpty()) {
                log.warn("Appointment not found for video signaling: {}", message.getAppointmentId());
                return;
            }

            Appointment appointment = appointmentOpt.get();
            String patientEmail = appointment.getPatient().getEmail();
            String doctorEmail = appointment.getDoctor().getEmail();

            String recipientEmail = null;
            boolean isSenderPatient = false;

            // Determine recipient based on sender role/email
            if (senderEmail.equalsIgnoreCase(patientEmail)) {
                recipientEmail = doctorEmail;
                isSenderPatient = true;
            } else if (senderEmail.equalsIgnoreCase(doctorEmail)) {
                recipientEmail = patientEmail;
                isSenderPatient = false;
            } else {
                log.warn("Unauthorized user {} attempted signaling on appointment {}", senderEmail, message.getAppointmentId());
                return;
            }

            // Set the sender email so recipient knows who sent it
            message.setSenderEmail(senderEmail);

            String signalType = message.getType();

            // Track active room presence & trigger exactly one waiting notification if alone
            if ("JOIN".equalsIgnoreCase(signalType)) {
                Set<String> participants = activeRoomParticipants.computeIfAbsent(appointmentId, k -> ConcurrentHashMap.newKeySet());
                boolean isFirstParticipant = participants.isEmpty() || (participants.size() == 1 && participants.contains(senderEmail.toLowerCase()));
                participants.add(senderEmail.toLowerCase());

                long now = System.currentTimeMillis();
                Long lastSent = lastWaitingNotificationTime.get(appointmentId);
                boolean cooldownElapsed = (lastSent == null) || (now - lastSent > 60_000); // 60s cooldown

                // Only send waiting notification if this participant is the FIRST one waiting in the room
                if (isFirstParticipant && cooldownElapsed) {
                    lastWaitingNotificationTime.put(appointmentId, now);

                    UUID recipientUserId = isSenderPatient
                            ? appointment.getDoctor().getUserId()
                            : appointment.getPatient().getId();

                    String senderDisplayName = isSenderPatient
                            ? appointment.getPatient().getFullName()
                            : "Dr. " + appointment.getDoctor().getUser().getFullName();

                    String waitingTitle = isSenderPatient
                            ? "Patient Waiting on Video Call"
                            : "Doctor Waiting on Video Call";

                    String waitingMessage = String.format("%s is waiting for you in the consultation room (%s). Click to review and join.",
                            senderDisplayName, appointment.getTimeSlot());

                    try {
                        log.info("Sending 1 CALL_WAITING notification from {} to user {} for appointment {}",
                                senderDisplayName, recipientUserId, appointmentId);

                        eventPublisher.publishEvent(new NotificationEvent(
                                this,
                                recipientUserId,
                                waitingTitle,
                                waitingMessage,
                                NotificationType.CALL_WAITING,
                                appointmentId.toString()
                        ));
                    } catch (Exception e) {
                        log.warn("Failed to publish CALL_WAITING notification: {}", e.getMessage());
                    }
                }
            } else if ("LEAVE".equalsIgnoreCase(signalType)) {
                Set<String> participants = activeRoomParticipants.get(appointmentId);
                if (participants != null) {
                    participants.remove(senderEmail.toLowerCase());
                    if (participants.isEmpty()) {
                        activeRoomParticipants.remove(appointmentId);
                        lastWaitingNotificationTime.remove(appointmentId);
                    }
                }
            }

            // Forward signaling message directly to the other user's queue
            messagingTemplate.convertAndSendToUser(
                    recipientEmail,
                    "/queue/video.signal",
                    message
            );

        } catch (IllegalArgumentException e) {
            log.warn("Invalid appointment ID format in video signal: {}", message.getAppointmentId());
        } catch (Exception e) {
            log.error("Error processing video signal: {}", e.getMessage(), e);
        }
    }
}
