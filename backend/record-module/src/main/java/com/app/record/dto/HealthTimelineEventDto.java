package com.app.record.dto;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public class HealthTimelineEventDto {
    private String id;
    private String eventType; // CONSULTATION, PRESCRIPTION, TREATMENT_PLAN, LAB_REPORT, MEDICATION_DOSE, PHARMACY_ORDER, CARE_TASK
    private LocalDateTime timestamp;
    private String title;
    private String subtitle;
    private String description;
    private String status;
    private String statusBadgeColor;
    private String iconType;
    private UUID referenceId;
    private String actionUrl;
    private Map<String, Object> metadata;

    public HealthTimelineEventDto() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getSubtitle() { return subtitle; }
    public void setSubtitle(String subtitle) { this.subtitle = subtitle; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getStatusBadgeColor() { return statusBadgeColor; }
    public void setStatusBadgeColor(String statusBadgeColor) { this.statusBadgeColor = statusBadgeColor; }

    public String getIconType() { return iconType; }
    public void setIconType(String iconType) { this.iconType = iconType; }

    public UUID getReferenceId() { return referenceId; }
    public void setReferenceId(UUID referenceId) { this.referenceId = referenceId; }

    public String getActionUrl() { return actionUrl; }
    public void setActionUrl(String actionUrl) { this.actionUrl = actionUrl; }

    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
}
