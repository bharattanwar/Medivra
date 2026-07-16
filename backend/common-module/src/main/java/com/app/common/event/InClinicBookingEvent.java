package com.app.common.event;

import org.springframework.context.ApplicationEvent;
import java.math.BigDecimal;
import java.util.UUID;

public class InClinicBookingEvent extends ApplicationEvent {
    private final UUID appointmentId;
    private final BigDecimal amount;

    public InClinicBookingEvent(Object source, UUID appointmentId, BigDecimal amount) {
        super(source);
        this.appointmentId = appointmentId;
        this.amount = amount;
    }

    public UUID getAppointmentId() {
        return appointmentId;
    }

    public BigDecimal getAmount() {
        return amount;
    }
}
