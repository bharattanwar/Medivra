package com.app.appointment.dto;

import java.time.LocalDate;
import java.util.UUID;

public class RescheduleAppointmentRequest {
    private LocalDate newDate;
    private String newTimeSlot;
    private String reason;
    private UUID rescheduledBy;

    public LocalDate getNewDate() {
        return newDate;
    }

    public void setNewDate(LocalDate newDate) {
        this.newDate = newDate;
    }

    public String getNewTimeSlot() {
        return newTimeSlot;
    }

    public void setNewTimeSlot(String newTimeSlot) {
        this.newTimeSlot = newTimeSlot;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public UUID getRescheduledBy() {
        return rescheduledBy;
    }

    public void setRescheduledBy(UUID rescheduledBy) {
        this.rescheduledBy = rescheduledBy;
    }
}
