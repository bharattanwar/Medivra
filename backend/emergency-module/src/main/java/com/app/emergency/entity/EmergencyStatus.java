package com.app.emergency.entity;

public enum EmergencyStatus {
    PENDING,
    SEARCHING,
    AMBULANCE_ASSIGNED,
    EN_ROUTE,
    ARRIVED_AT_PATIENT,
    TRANSPORTING,
    ARRIVED_AT_HOSPITAL,
    COMPLETED,
    CANCELLED,
    ESCALATED
}
