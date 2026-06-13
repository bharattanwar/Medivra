package com.app.appointment.dto;

import java.util.UUID;

public class CancelAppointmentRequest {
    private String reason;
    private UUID cancelledBy;

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public UUID getCancelledBy() {
        return cancelledBy;
    }

    public void setCancelledBy(UUID cancelledBy) {
        this.cancelledBy = cancelledBy;
    }
}
