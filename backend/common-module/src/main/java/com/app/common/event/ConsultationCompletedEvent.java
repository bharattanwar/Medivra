package com.app.common.event;

import org.springframework.context.ApplicationEvent;
import java.util.UUID;

public class ConsultationCompletedEvent extends ApplicationEvent {
    private final UUID appointmentId;
    private final UUID patientId;
    private final UUID doctorId;

    public ConsultationCompletedEvent(Object source, UUID appointmentId, UUID patientId, UUID doctorId) {
        super(source);
        this.appointmentId = appointmentId;
        this.patientId = patientId;
        this.doctorId = doctorId;
    }

    public UUID getAppointmentId() {
        return appointmentId;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public UUID getDoctorId() {
        return doctorId;
    }
}
