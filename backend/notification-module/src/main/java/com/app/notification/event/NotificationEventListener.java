package com.app.notification.event;

import com.app.common.event.NotificationEvent;
import com.app.notification.service.NotificationService;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class NotificationEventListener {

    private final NotificationService notificationService;

    public NotificationEventListener(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @EventListener
    public void handleNotificationEvent(NotificationEvent event) {
        notificationService.createNotification(
                event.getRecipientId(),
                event.getTitle(),
                event.getMessage(),
                event.getType(),
                event.getRelatedEntityId()
        );
    }
}
