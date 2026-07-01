package com.app.notification.event;

import com.app.common.event.NotificationEvent;
import com.app.notification.service.NotificationService;
import com.app.notification.service.EmailService;
import com.app.user.repository.UserRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import org.springframework.scheduling.annotation.Async;

@Component
public class NotificationEventListener {

    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final EmailService emailService;

    public NotificationEventListener(NotificationService notificationService,
                                     UserRepository userRepository,
                                     EmailService emailService) {
        this.notificationService = notificationService;
        this.userRepository = userRepository;
        this.emailService = emailService;
    }

    @Async
    @EventListener
    public void handleNotificationEvent(NotificationEvent event) {
        // 1. Create DB and Live WebSocket notification
        notificationService.createNotification(
                event.getRecipientId(),
                event.getTitle(),
                event.getMessage(),
                event.getType(),
                event.getRelatedEntityId()
        );

        // 2. Dispatch Outbound Email
        try {
            userRepository.findById(event.getRecipientId()).ifPresent(user -> {
                String recipientEmail = user.getEmail();
                String subject = "[MediVra] " + event.getTitle();
                String content = String.format("Hello %s,\n\nYou have received a new notification from MediVra:\n\n%s\n\nBest regards,\nThe MediVra Team",
                        user.getFullName() != null ? user.getFullName() : "User",
                        event.getMessage());
                emailService.sendEmail(recipientEmail, subject, content);
            });
        } catch (Exception e) {
            System.err.println("Failed to dispatch email: " + e.getMessage());
        }
    }
}
