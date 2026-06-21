package com.app.common.event;

import org.springframework.context.ApplicationEvent;
import java.util.UUID;

public class RescheduleEvent extends ApplicationEvent {
    private final UUID oldAppointmentId;
    private final UUID newAppointmentId;
    private final boolean accepted;

    public RescheduleEvent(Object source, UUID oldAppointmentId, UUID newAppointmentId, boolean accepted) {
        super(source);
        this.oldAppointmentId = oldAppointmentId;
        this.newAppointmentId = newAppointmentId;
        this.accepted = accepted;
    }

    public UUID getOldAppointmentId() {
        return oldAppointmentId;
    }

    public UUID getNewAppointmentId() {
        return newAppointmentId;
    }

    public boolean isAccepted() {
        return accepted;
    }
}
