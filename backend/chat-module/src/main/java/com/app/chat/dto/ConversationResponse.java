package com.app.chat.dto;

import java.util.UUID;

public class ConversationResponse {
    private UUID id;
    private UUID appointmentId;
    private UUID doctorId;
    private UUID patientId;
    private String otherPartyName;
    private String otherPartyRole;
    private long unreadCount;
    private MessageResponse lastMessage;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getAppointmentId() {
        return appointmentId;
    }

    public void setAppointmentId(UUID appointmentId) {
        this.appointmentId = appointmentId;
    }

    public UUID getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(UUID doctorId) {
        this.doctorId = doctorId;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public String getOtherPartyName() {
        return otherPartyName;
    }

    public void setOtherPartyName(String otherPartyName) {
        this.otherPartyName = otherPartyName;
    }

    public String getOtherPartyRole() {
        return otherPartyRole;
    }

    public void setOtherPartyRole(String otherPartyRole) {
        this.otherPartyRole = otherPartyRole;
    }

    public long getUnreadCount() {
        return unreadCount;
    }

    public void setUnreadCount(long unreadCount) {
        this.unreadCount = unreadCount;
    }

    public MessageResponse getLastMessage() {
        return lastMessage;
    }

    public void setLastMessage(MessageResponse lastMessage) {
        this.lastMessage = lastMessage;
    }
}
