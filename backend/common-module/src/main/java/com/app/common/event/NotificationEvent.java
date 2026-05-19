package com.app.common.event;

import com.app.common.entity.NotificationType;
import org.springframework.context.ApplicationEvent;

import java.util.UUID;

public class NotificationEvent extends ApplicationEvent {
    private final UUID recipientId;
    private final String title;
    private final String message;
    private final NotificationType type;
    private final String relatedEntityId;

    public NotificationEvent(Object source, UUID recipientId, String title, String message,
                             NotificationType type, String relatedEntityId) {
        super(source);
        this.recipientId = recipientId;
        this.title = title;
        this.message = message;
        this.type = type;
        this.relatedEntityId = relatedEntityId;
    }

    public UUID getRecipientId() {
        return recipientId;
    }

    public String getTitle() {
        return title;
    }

    public String getMessage() {
        return message;
    }

    public NotificationType getType() {
        return type;
    }

    public String getRelatedEntityId() {
        return relatedEntityId;
    }
}
