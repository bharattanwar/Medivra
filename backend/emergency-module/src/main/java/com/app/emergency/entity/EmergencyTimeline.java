package com.app.emergency.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "emergency_timelines")
public class EmergencyTimeline extends BaseEntity {

    @Column(name = "emergency_id", nullable = false)
    private UUID emergencyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event", nullable = false)
    private EmergencyTimelineEvent event;

    @Column(name = "description")
    private String description;

    @Column(name = "event_timestamp", nullable = false)
    private LocalDateTime eventTimestamp;

    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;

    public UUID getEmergencyId() { return emergencyId; }
    public void setEmergencyId(UUID emergencyId) { this.emergencyId = emergencyId; }

    public EmergencyTimelineEvent getEvent() { return event; }
    public void setEvent(EmergencyTimelineEvent event) { this.event = event; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getEventTimestamp() { return eventTimestamp; }
    public void setEventTimestamp(LocalDateTime eventTimestamp) { this.eventTimestamp = eventTimestamp; }

    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
}
