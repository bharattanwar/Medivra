package com.app.common.event;

import org.springframework.context.ApplicationEvent;

import java.util.UUID;

/**
 * Published by appointment-module when a paid appointment is cancelled/rejected
 * and an automatic refund should be initiated.
 * Listened to by payment-module's RefundEventListener.
 */
public class RefundEvent extends ApplicationEvent {
    private final UUID appointmentId;

    public RefundEvent(Object source, UUID appointmentId) {
        super(source);
        this.appointmentId = appointmentId;
    }

    public UUID getAppointmentId() {
        return appointmentId;
    }
}
