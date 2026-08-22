package com.app.notification.service;

import com.app.common.entity.NotificationType;
import com.app.notification.dto.NotificationResponse;
import com.app.notification.entity.Notification;
import com.app.notification.repository.NotificationRepository;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service responsible for creating, persisting, and dispatching in-app notifications.
 *
 * It persists notifications to the database and dispatches live updates to users
 * connected via WebSocket (STOMP user queues).
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public NotificationService(NotificationRepository notificationRepository,
                               UserRepository userRepository,
                               SimpMessagingTemplate messagingTemplate) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Creates a new notification record in the database and pushes it to the recipient's
     * WebSocket queue for real-time delivery.
     */
    @Transactional
    public NotificationResponse createNotification(UUID recipientId, String title, String message,
                                                   NotificationType type, String relatedEntityId) {
        User recipient = userRepository.findById(recipientId)
                .orElseThrow(() -> new RuntimeException("Recipient user not found: " + recipientId));

        Notification notification = new Notification();
        notification.setRecipient(recipient);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setType(type);
        notification.setRelatedEntityId(relatedEntityId);
        notification.setRead(false);

        Notification saved = notificationRepository.save(notification);
        NotificationResponse response = mapToResponse(saved);

        // Deliver live via WebSocket
        try {
            messagingTemplate.convertAndSendToUser(
                    recipient.getEmail(),
                    "/queue/notifications",
                    response
            );
        } catch (Exception e) {
            log.warn("Failed to send WebSocket notification to {}: {}", recipient.getEmail(), e.getMessage());
        }

        return response;
    }

    /**
     * Retrieves all notifications for a specific user ordered by creation time descending.
     */
    @Transactional(readOnly = true)
    public List<NotificationResponse> getNotificationsForUser(UUID userId) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Gets the count of unread notifications for a user.
     */
    @Transactional(readOnly = true)
    public long getUnreadCount(UUID userId) {
        return notificationRepository.countByRecipientIdAndIsReadFalse(userId);
    }

    /**
     * Marks a specific notification as read after validating that the user is the recipient.
     */
    @Transactional
    public void markAsRead(UUID notificationId, UUID userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        if (!notification.getRecipient().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized to modify this notification");
        }

        notification.setRead(true);
        notificationRepository.save(notification);
    }

    /**
     * Marks all unread notifications for a user as read using a single bulk SQL update.
     */
    @Transactional
    public void markAllAsRead(UUID userId) {
        notificationRepository.markAllAsReadByRecipientId(userId);
    }

    private NotificationResponse mapToResponse(Notification notification) {
        NotificationResponse response = new NotificationResponse();
        response.setId(notification.getId());
        response.setRecipientId(notification.getRecipient().getId());
        response.setTitle(notification.getTitle());
        response.setMessage(notification.getMessage());
        response.setType(notification.getType().name());
        response.setRead(notification.isRead());
        response.setRelatedEntityId(notification.getRelatedEntityId());
        response.setCreatedAt(notification.getCreatedAt());
        return response;
    }
}
