package com.app.emergency.service;

import com.app.emergency.entity.EmergencyContact;
import com.app.emergency.entity.EmergencyRequest;
import com.app.notification.service.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EmergencyNotificationService {

    private static final Logger log = LoggerFactory.getLogger(EmergencyNotificationService.class);

    private final SimpMessagingTemplate messagingTemplate;
    private final EmailService emailService;

    public EmergencyNotificationService(SimpMessagingTemplate messagingTemplate,
                                         EmailService emailService) {
        this.messagingTemplate = messagingTemplate;
        this.emailService = emailService;
    }

    /**
     * Broadcasts status update to the patient via WebSocket.
     */
    public void broadcastStatusUpdate(EmergencyRequest emergency) {
        try {
            messagingTemplate.convertAndSendToUser(
                    emergency.getPatientId().toString(),
                    "/queue/sos",
                    emergency);
        } catch (Exception e) {
            log.error("Failed to broadcast SOS update for emergency {}", emergency.getId(), e);
        }
    }

    /**
     * Notifies emergency contacts via email when SOS is triggered.
     */
    @Async
    public void notifyEmergencyContacts(List<EmergencyContact> contacts,
                                         EmergencyRequest emergency,
                                         String patientName) {
        if (contacts.isEmpty()) return;

        String mapsLink = "https://maps.google.com/?q=" + emergency.getPatientLat() + "," + emergency.getPatientLng();
        String subject = "🚨 EMERGENCY: " + patientName + " has triggered an SOS";
        String body = buildEmergencyEmailBody(patientName, emergency, mapsLink);

        for (EmergencyContact contact : contacts) {
            if (contact.getEmail() != null && !contact.getEmail().isBlank()) {
                try {
                    emailService.sendEmail(contact.getEmail(), subject, body);
                    log.info("Notified emergency contact {} for emergency {}", contact.getEmail(), emergency.getId());
                } catch (Exception e) {
                    log.error("Failed to notify contact {} for emergency {}", contact.getEmail(), emergency.getId(), e);
                }
            }
        }
    }

    /**
     * Sends escalation alert to emergency contacts when no ambulance is found.
     */
    @Async
    public void notifyEscalationToContacts(List<EmergencyContact> contacts,
                                            EmergencyRequest emergency,
                                            String patientName) {
        if (contacts.isEmpty()) return;

        String subject = "⚠️ URGENT: No ambulance found for " + patientName + " — Please call 112";
        String body = "Dear Emergency Contact,\n\n" +
                "CRITICAL ALERT: We have been unable to find an available ambulance for " + patientName + ".\n\n" +
                "PLEASE CALL 112 (National Emergency) IMMEDIATELY.\n\n" +
                "Patient Location: https://maps.google.com/?q=" + emergency.getPatientLat() + "," + emergency.getPatientLng() + "\n\n" +
                "Emergency ID: " + emergency.getId() + "\n" +
                "Type: " + emergency.getEmergencyType().name() + "\n\n" +
                "Medivra Emergency Team";

        for (EmergencyContact contact : contacts) {
            if (contact.getEmail() != null && !contact.getEmail().isBlank()) {
                try {
                    emailService.sendEmail(contact.getEmail(), subject, body);
                } catch (Exception e) {
                    log.error("Failed to send escalation to {}", contact.getEmail(), e);
                }
            }
        }
    }

    /**
     * Notifies hospital dashboard via topic broadcast.
     */
    public void notifyHospital(java.util.UUID hospitalId, EmergencyRequest emergency) {
        try {
            messagingTemplate.convertAndSend("/topic/hospital/" + hospitalId + "/emergencies", emergency);
        } catch (Exception e) {
            log.error("Failed to notify hospital {}", hospitalId, e);
        }
    }

    private String buildEmergencyEmailBody(String patientName, EmergencyRequest emergency, String mapsLink) {
        return "Dear Emergency Contact,\n\n" +
                "⚠️ EMERGENCY ALERT ⚠️\n\n" +
                patientName + " has triggered an Emergency SOS on Medivra.\n\n" +
                "📍 Location: " + (emergency.getPatientAddress() != null ? emergency.getPatientAddress() : "See map link") + "\n" +
                "🗺️ Google Maps: " + mapsLink + "\n" +
                "🚨 Emergency Type: " + emergency.getEmergencyType().name() + "\n" +
                "⏰ Time: " + emergency.getCreatedAt() + "\n\n" +
                "An ambulance has been dispatched. You will receive further updates.\n\n" +
                "Emergency ID: " + emergency.getId() + "\n\n" +
                "Stay calm and contact " + patientName + " if possible.\n\n" +
                "— Medivra Emergency Response Team";
    }
}
