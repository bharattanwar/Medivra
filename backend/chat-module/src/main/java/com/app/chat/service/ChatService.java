package com.app.chat.service;

import com.app.appointment.entity.Appointment;
import com.app.appointment.repository.AppointmentRepository;
import com.app.chat.dto.ConversationResponse;
import com.app.chat.dto.MessageResponse;
import com.app.chat.dto.SendMessageRequest;
import com.app.chat.entity.Conversation;
import com.app.chat.entity.Message;
import com.app.chat.entity.MessageType;
import com.app.chat.repository.ConversationRepository;
import com.app.chat.repository.MessageRepository;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service managing real-time chat conversations and WebSocket message dispatch
 * between doctors and patients during active consultation lifecycles.
 *
 * Workflow:
 * 1. createConversation: Automatically initialized when an appointment is confirmed/paid.
 * 2. sendMessage: Persists chat/attachment messages and publishes to recipient + sender STOMP queues.
 * 3. getMessages: Fetches conversation transcript and auto-marks incoming messages as read.
 * 4. getUserConversations: Fetches active conversations for a patient or doctor with other-party info.
 */
@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatService(ConversationRepository conversationRepository,
                       MessageRepository messageRepository,
                       AppointmentRepository appointmentRepository,
                       UserRepository userRepository,
                       SimpMessagingTemplate messagingTemplate) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Creates or fetches the conversation channel tied to a specific appointment ID.
     */
    @Transactional
    public Conversation createConversation(UUID appointmentId) {
        return conversationRepository.findByAppointmentId(appointmentId)
                .orElseGet(() -> {
                    Appointment appointment = appointmentRepository.findById(appointmentId)
                            .orElseThrow(() -> new RuntimeException("Appointment not found"));

                    Conversation conversation = new Conversation();
                    conversation.setAppointment(appointment);
                    conversation.setDoctor(appointment.getDoctor());
                    conversation.setPatient(appointment.getPatient());
                    return conversationRepository.save(conversation);
                });
    }

    @Transactional(readOnly = true)
    public Optional<ConversationResponse> getConversationByAppointment(UUID appointmentId) {
        return conversationRepository.findByAppointmentId(appointmentId)
                .map(c -> mapToConversationResponse(c, null));
    }

    /**
     * Persists a message and broadcasts to WebSocket queues for both participants.
     */
    @Transactional
    public MessageResponse sendMessage(SendMessageRequest request, UUID senderId) {
        Conversation conversation = conversationRepository.findById(request.getConversationId())
                .orElseThrow(() -> new RuntimeException("Conversation not found"));
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Message message = new Message();
        message.setConversation(conversation);
        message.setSender(sender);
        message.setContent(request.getContent());
        message.setType(request.getType() != null ? request.getType() : MessageType.CHAT);
        message.setFileUrl(request.getFileUrl());
        message.setRead(false);

        message = messageRepository.save(message);
        MessageResponse response = mapToMessageResponse(message);

        // Determine other party's email for private queue delivery
        String recipientEmail = senderId.equals(conversation.getPatient().getId())
                ? conversation.getDoctor().getUser().getEmail()
                : conversation.getPatient().getEmail();

        try {
            messagingTemplate.convertAndSendToUser(recipientEmail, "/queue/messages", response);
            messagingTemplate.convertAndSendToUser(sender.getEmail(), "/queue/messages", response);
        } catch (Exception e) {
            log.warn("Failed to push chat message over WebSocket: {}", e.getMessage());
        }

        return response;
    }

    /**
     * Retrieves ordered message log for a conversation and marks unread messages as read.
     */
    @Transactional
    public List<MessageResponse> getMessages(UUID conversationId, UUID userId) {
        List<Message> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);

        List<Message> unreadToUpdate = messages.stream()
                .filter(m -> !m.isRead() && !m.getSender().getId().equals(userId))
                .peek(m -> m.setRead(true))
                .collect(Collectors.toList());

        if (!unreadToUpdate.isEmpty()) {
            messageRepository.saveAll(unreadToUpdate);
        }

        return messages.stream().map(this::mapToMessageResponse).collect(Collectors.toList());
    }

    /**
     * Retrieves all conversations associated with a user (patient or doctor).
     */
    @Transactional(readOnly = true)
    public List<ConversationResponse> getUserConversations(UUID userId) {
        List<Conversation> conversations = conversationRepository.findByUserId(userId);
        return conversations.stream()
                .map(c -> mapToConversationResponse(c, userId))
                .collect(Collectors.toList());
    }

    private MessageResponse mapToMessageResponse(Message message) {
        MessageResponse response = new MessageResponse();
        response.setId(message.getId());
        response.setConversationId(message.getConversation().getId());
        response.setSenderId(message.getSender().getId());
        response.setContent(message.getContent());
        response.setType(message.getType());
        response.setCreatedAt(message.getCreatedAt());
        response.setRead(message.isRead());
        response.setFileUrl(message.getFileUrl());
        return response;
    }

    private ConversationResponse mapToConversationResponse(Conversation conversation, UUID currentUserId) {
        ConversationResponse response = new ConversationResponse();
        response.setId(conversation.getId());
        response.setAppointmentId(conversation.getAppointment().getId());
        response.setDoctorId(conversation.getDoctor().getUser().getId());
        response.setPatientId(conversation.getPatient().getId());

        if (currentUserId != null) {
            boolean isPatient = currentUserId.equals(conversation.getPatient().getId());
            if (isPatient) {
                response.setOtherPartyName("Dr. " + conversation.getDoctor().getUser().getFullName());
                response.setOtherPartyRole("DOCTOR");
            } else {
                response.setOtherPartyName(conversation.getPatient().getFullName());
                response.setOtherPartyRole("PATIENT");
            }
            long unread = messageRepository.countByConversationIdAndIsReadFalseAndSenderIdNot(
                    conversation.getId(), currentUserId
            );
            response.setUnreadCount(unread);
        }

        return response;
    }
}
