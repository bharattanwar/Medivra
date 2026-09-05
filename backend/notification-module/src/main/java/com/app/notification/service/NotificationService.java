package com.app.notification.service;

import com.app.common.entity.NotificationType;
import com.app.notification.dto.NotificationResponse;
import com.app.notification.entity.Notification;
import com.app.notification.entity.PushToken;
import com.app.notification.repository.NotificationRepository;
import com.app.notification.repository.PushTokenRepository;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * Service responsible for creating, persisting, and dispatching in-app notifications,
 * WebSocket real-time updates, and Expo push notifications.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    private final NotificationRepository notificationRepository;
    private final PushTokenRepository pushTokenRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final RestTemplate restTemplate = new RestTemplate();

    public NotificationService(NotificationRepository notificationRepository,
                               PushTokenRepository pushTokenRepository,
                               UserRepository userRepository,
                               SimpMessagingTemplate messagingTemplate) {
        this.notificationRepository = notificationRepository;
        this.pushTokenRepository = pushTokenRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Creates a new notification record in the database and pushes it to the recipient's
     * WebSocket queue and mobile devices via push notification.
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

        // Deliver mobile push notification asynchronously
        dispatchPushNotificationAsync(recipientId, title, message, type.name(), relatedEntityId);

        return response;
    }

    /**
     * Dispatches push notifications to registered device tokens for a given user.
     */
    public void dispatchPushNotificationAsync(UUID recipientId, String title, String body, String type, String relatedEntityId) {
        CompletableFuture.runAsync(() -> {
            try {
                List<PushToken> tokens = pushTokenRepository.findByUserId(recipientId);
                if (tokens == null || tokens.isEmpty()) {
                    return;
                }

                List<Map<String, Object>> messages = new ArrayList<>();
                for (PushToken pushToken : tokens) {
                    String token = pushToken.getToken();
                    if (token != null && (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["))) {
                        Map<String, Object> payload = new HashMap<>();
                        payload.put("to", token);
                        payload.put("title", title);
                        payload.put("body", body);
                        payload.put("sound", "default");

                        Map<String, Object> data = new HashMap<>();
                        data.put("type", type);
                        data.put("relatedEntityId", relatedEntityId);
                        payload.put("data", data);

                        messages.add(payload);
                    }
                }

                if (!messages.isEmpty()) {
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_JSON);
                    headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

                    HttpEntity<List<Map<String, Object>>> request = new HttpEntity<>(messages, headers);
                    restTemplate.postForObject(EXPO_PUSH_URL, request, String.class);
                    log.info("Dispatched {} push notification(s) to recipient {}", messages.size(), recipientId);
                }
            } catch (Exception e) {
                log.warn("Failed to dispatch push notification to user {}: {}", recipientId, e.getMessage());
            }
        });
    }

    /**
     * Registers or updates a device push token for a user.
     */
    @Transactional
    public void registerPushToken(UUID userId, String token, String deviceType) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        Optional<PushToken> existing = pushTokenRepository.findByUserIdAndToken(userId, token);
        if (existing.isEmpty()) {
            PushToken pushToken = new PushToken(user, token, deviceType);
            pushTokenRepository.save(pushToken);
            log.info("Registered new push token for user {}", userId);
        } else {
            PushToken pushToken = existing.get();
            if (deviceType != null && !deviceType.equals(pushToken.getDeviceType())) {
                pushToken.setDeviceType(deviceType);
                pushTokenRepository.save(pushToken);
            }
        }
    }

    /**
     * Unregisters a device push token for a user (e.g. on logout).
     */
    @Transactional
    public void removePushToken(UUID userId, String token) {
        pushTokenRepository.deleteByUserIdAndToken(userId, token);
        log.info("Removed push token for user {}", userId);
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
