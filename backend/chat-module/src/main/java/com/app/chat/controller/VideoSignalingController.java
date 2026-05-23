package com.app.chat.controller;

import com.app.appointment.entity.Appointment;
import com.app.appointment.repository.AppointmentRepository;
import com.app.chat.dto.VideoSignalMessage;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;


import java.util.Optional;
import java.util.UUID;

@Controller
public class VideoSignalingController {

    private final SimpMessagingTemplate messagingTemplate;
    private final AppointmentRepository appointmentRepository;

    public VideoSignalingController(SimpMessagingTemplate messagingTemplate, AppointmentRepository appointmentRepository) {
        this.messagingTemplate = messagingTemplate;
        this.appointmentRepository = appointmentRepository;
    }

    @MessageMapping("/video.signal")
    public void handleVideoSignal(@Payload VideoSignalMessage message, Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserDetails)) {
            System.err.println("Unauthenticated video signal received");
            return;
        }

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        String senderEmail = userDetails.getUsername();

        try {
            UUID appointmentId = UUID.fromString(message.getAppointmentId());
            // Use JOIN FETCH query to eagerly load patient and doctor — avoids LazyInitializationException
            // in WebSocket STOMP handlers which run outside Spring's HTTP transaction context.
            Optional<Appointment> appointmentOpt = appointmentRepository.findByIdWithParties(appointmentId);

            if (appointmentOpt.isEmpty()) {
                System.err.println("Appointment not found for signaling: " + message.getAppointmentId());
                return;
            }

            Appointment appointment = appointmentOpt.get();
            String patientEmail = appointment.getPatient().getEmail();
            String doctorEmail = appointment.getDoctor().getEmail();

            String recipientEmail = null;

            // Determine recipient based on sender role/email
            if (senderEmail.equalsIgnoreCase(patientEmail)) {
                recipientEmail = doctorEmail;
            } else if (senderEmail.equalsIgnoreCase(doctorEmail)) {
                recipientEmail = patientEmail;
            } else {
                System.err.println("Unauthorized user " + senderEmail + " attempted signaling on appointment " + message.getAppointmentId());
                return;
            }

            // Set the sender email so recipient knows who sent it
            message.setSenderEmail(senderEmail);

            // Forward signaling message directly to the other user's queue
            messagingTemplate.convertAndSendToUser(
                    recipientEmail,
                    "/queue/video.signal",
                    message
            );

        } catch (IllegalArgumentException e) {
            System.err.println("Invalid appointment ID format in video signal: " + message.getAppointmentId());
        } catch (Exception e) {
            System.err.println("Error processing video signal: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
