package com.app.appointment.service;

import com.app.appointment.dto.AppointmentRequest;
import com.app.appointment.dto.AppointmentResponse;
import com.app.appointment.dto.CancelAppointmentRequest;
import com.app.appointment.dto.RescheduleAppointmentRequest;
import com.app.appointment.entity.Appointment;
import com.app.appointment.entity.AppointmentStatus;
import com.app.appointment.repository.AppointmentRepository;
import com.app.doctor.entity.Doctor;
import com.app.doctor.repository.DoctorRepository;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import com.app.common.event.NotificationEvent;
import com.app.common.event.RefundEvent;
import com.app.common.event.RescheduleEvent;
import com.app.common.entity.NotificationType;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final ApplicationEventPublisher eventPublisher;

    public AppointmentService(AppointmentRepository appointmentRepository,
                              DoctorRepository doctorRepository,
                              UserRepository userRepository,
                              ApplicationEventPublisher eventPublisher) {
        this.appointmentRepository = appointmentRepository;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public AppointmentResponse bookAppointment(AppointmentRequest request) {
        Doctor doctor = doctorRepository.findById(request.getDoctorId())
                .orElseThrow(() -> new RuntimeException("Doctor not found"));

        User patient = userRepository.findById(request.getPatientId())
                .orElseThrow(() -> new RuntimeException("Patient not found"));

        // Check if patient is blocked
        if (Boolean.TRUE.equals(patient.isBlocked())) {
            if (patient.getBlockedUntil() != null && java.time.LocalDateTime.now().isAfter(patient.getBlockedUntil())) {
                patient.setBlocked(false);
                patient.setBlockedUntil(null);
                userRepository.save(patient);
            } else {
                throw new RuntimeException("Your account is currently blocked.");
            }
        }

        // Count patient's appointments created today
        java.time.LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        java.time.LocalDateTime endOfDay = LocalDate.now().atTime(23, 59, 59, 999999999);
        long appointmentsToday = appointmentRepository.countAppointmentsForPatientToday(patient.getId(), startOfDay, endOfDay);
        if (appointmentsToday >= 4) {
            patient.setBlocked(true);
            patient.setBlockedUntil(java.time.LocalDateTime.now().plusHours(24));
            userRepository.save(patient);
            throw new RuntimeException("Your account has been blocked for 24 hours due to excessive booking attempts.");
        }

        Appointment appointment = new Appointment();
        appointment.setDoctor(doctor);
        appointment.setPatient(patient);
        appointment.setAppointmentDate(request.getAppointmentDate());
        appointment.setTimeSlot(request.getTimeSlot());
        if (request.getConsultationType() != null) {
            appointment.setConsultationType(request.getConsultationType());
        }

        // Validate doctor's consultation type availability
        if (appointment.getConsultationType() == com.app.appointment.entity.ConsultationType.IN_CLINIC && !Boolean.TRUE.equals(doctor.getAvailableInClinic())) {
            throw new RuntimeException("This doctor is not available for in-clinic consultations.");
        }
        if (appointment.getConsultationType() == com.app.appointment.entity.ConsultationType.ONLINE && !Boolean.TRUE.equals(doctor.getAvailableVideo())) {
            throw new RuntimeException("This doctor is not available for video consultations.");
        }
        
        if (appointment.getConsultationType() == com.app.appointment.entity.ConsultationType.IN_CLINIC) {
            appointment.setStatus(AppointmentStatus.CONFIRMED);
        } else {
            appointment.setStatus(AppointmentStatus.PENDING);
        }

        Appointment savedAppointment = appointmentRepository.save(appointment);

        // If in-clinic, publish InClinicBookingEvent so payment-module creates the pending payment record
        if (appointment.getConsultationType() == com.app.appointment.entity.ConsultationType.IN_CLINIC) {
            try {
                eventPublisher.publishEvent(new com.app.common.event.InClinicBookingEvent(
                    this,
                    savedAppointment.getId(),
                    doctor.getConsultationFee() != null ? doctor.getConsultationFee() : java.math.BigDecimal.valueOf(500)
                ));
            } catch (Exception e) {
                System.err.println("Failed to publish InClinicBookingEvent: " + e.getMessage());
            }
        }

        // Publish appointment booked notification for the Doctor
        try {
            boolean isInClinic = appointment.getConsultationType() == com.app.appointment.entity.ConsultationType.IN_CLINIC;
            eventPublisher.publishEvent(new NotificationEvent(
                this,
                doctor.getUserId(),
                isInClinic ? "New In-Clinic Consultation Booked" : "New Appointment Request",
                String.format("You have a new %s booking request from %s for %s at %s.", 
                    isInClinic ? "in-clinic (pay at clinic)" : "online consultation",
                    patient.getFullName(), 
                    savedAppointment.getAppointmentDate().toString(), 
                    savedAppointment.getTimeSlot()),
                isInClinic ? NotificationType.APPOINTMENT_CONFIRMED : NotificationType.APPOINTMENT_BOOKED,
                savedAppointment.getId().toString()
            ));
        } catch (Exception e) {
            System.err.println("Failed to publish AppointmentBooked event: " + e.getMessage());
        }

        return mapToResponse(savedAppointment);
    }

    @Transactional
    public AppointmentResponse cancelAppointment(UUID id, CancelAppointmentRequest request) {
        Appointment appointment = appointmentRepository.findByIdWithParties(id)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        AppointmentStatus currentStatus = appointment.getStatus();
        if (currentStatus != AppointmentStatus.PENDING && currentStatus != AppointmentStatus.CONFIRMED) {
            throw new RuntimeException("Only PENDING or CONFIRMED appointments can be cancelled. Current status: " + currentStatus);
        }

        LocalDate today = LocalDate.now();
        if (!appointment.getAppointmentDate().isAfter(today)) {
            throw new RuntimeException("Cancellation is only allowed at least a day before the actual consultation date.");
        }

        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointment.setCancellationReason(request.getReason());
        appointment.setCancelledBy(request.getCancelledBy());
        appointmentRepository.save(appointment);

        // If appointment was CONFIRMED (paid), publish refund event
        if (currentStatus == AppointmentStatus.CONFIRMED) {
            try {
                eventPublisher.publishEvent(new RefundEvent(this, id));
            } catch (Exception e) {
                System.err.println("Failed to publish refund event for appointment " + id + ": " + e.getMessage());
            }
        }

        // Determine who to notify (notify the other party)
        UUID cancelledBy = request.getCancelledBy();
        UUID doctorUserId = appointment.getDoctor().getUserId();
        UUID patientId = appointment.getPatient().getId();
        boolean cancelledByDoctor = cancelledBy.equals(doctorUserId);

        UUID recipientId = cancelledByDoctor ? patientId : doctorUserId;
        String cancellerName = cancelledByDoctor 
                ? "Dr. " + appointment.getDoctor().getUser().getFullName()
                : appointment.getPatient().getFullName();

        try {
            eventPublisher.publishEvent(new NotificationEvent(
                this,
                recipientId,
                "Appointment Cancelled",
                String.format("Your appointment on %s at %s has been cancelled by %s. Reason: %s",
                    appointment.getAppointmentDate().toString(),
                    appointment.getTimeSlot(),
                    cancellerName,
                    request.getReason() != null ? request.getReason() : "No reason provided"),
                NotificationType.APPOINTMENT_CANCELLED,
                appointment.getId().toString()
            ));
        } catch (Exception e) {
            System.err.println("Failed to publish cancellation notification: " + e.getMessage());
        }

        return mapToResponse(appointment);
    }

    @Transactional
    public AppointmentResponse rejectAppointment(UUID id, CancelAppointmentRequest request) {
        Appointment appointment = appointmentRepository.findByIdWithParties(id)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        if (appointment.getStatus() != AppointmentStatus.PENDING) {
            throw new RuntimeException("Only PENDING appointments can be rejected. Current status: " + appointment.getStatus());
        }

        appointment.setStatus(AppointmentStatus.REJECTED);
        appointment.setCancellationReason(request.getReason());
        appointment.setCancelledBy(request.getCancelledBy());
        appointmentRepository.save(appointment);

        // Notify the patient about the rejection
        try {
            eventPublisher.publishEvent(new NotificationEvent(
                this,
                appointment.getPatient().getId(),
                "Appointment Rejected",
                String.format("Dr. %s has declined your appointment request for %s at %s. Reason: %s",
                    appointment.getDoctor().getUser().getFullName(),
                    appointment.getAppointmentDate().toString(),
                    appointment.getTimeSlot(),
                    request.getReason() != null ? request.getReason() : "No reason provided"),
                NotificationType.APPOINTMENT_REJECTED,
                appointment.getId().toString()
            ));
        } catch (Exception e) {
            System.err.println("Failed to publish rejection notification: " + e.getMessage());
        }

        return mapToResponse(appointment);
    }

    @Transactional
    public AppointmentResponse rescheduleAppointment(UUID id, RescheduleAppointmentRequest request) {
        Appointment oldAppointment = appointmentRepository.findByIdWithParties(id)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        AppointmentStatus currentStatus = oldAppointment.getStatus();
        if (currentStatus != AppointmentStatus.PENDING && currentStatus != AppointmentStatus.CONFIRMED) {
            throw new RuntimeException("Only PENDING or CONFIRMED appointments can be rescheduled. Current status: " + currentStatus);
        }

        LocalDate today = LocalDate.now();
        if (!oldAppointment.getAppointmentDate().isAfter(today)) {
            throw new RuntimeException("Rescheduling is only allowed at least a day before the actual consultation date.");
        }

        User patient = oldAppointment.getPatient();
        if (Boolean.TRUE.equals(patient.isBlocked())) {
            if (patient.getBlockedUntil() != null && java.time.LocalDateTime.now().isAfter(patient.getBlockedUntil())) {
                patient.setBlocked(false);
                patient.setBlockedUntil(null);
                userRepository.save(patient);
            } else {
                throw new RuntimeException("Your account is currently blocked.");
            }
        }

        // Mark old appointment as RESCHEDULED
        oldAppointment.setStatus(AppointmentStatus.RESCHEDULED);
        oldAppointment.setCancellationReason("Rescheduled: " + (request.getReason() != null ? request.getReason() : "No reason provided"));
        oldAppointment.setCancelledBy(request.getRescheduledBy());
        appointmentRepository.save(oldAppointment);

        // Create new appointment with the new date/time
        Appointment newAppointment = new Appointment();
        newAppointment.setDoctor(oldAppointment.getDoctor());
        newAppointment.setPatient(oldAppointment.getPatient());
        newAppointment.setAppointmentDate(request.getNewDate());
        newAppointment.setTimeSlot(request.getNewTimeSlot());
        newAppointment.setRescheduledFrom(oldAppointment);
        newAppointment.setPreviousStatus(currentStatus);
        newAppointment.setStatus(AppointmentStatus.PENDING_RESCHEDULE);
        newAppointment.setCancelledBy(request.getRescheduledBy());
        newAppointment.setCancellationReason(request.getReason() != null ? request.getReason() : "No reason provided");

        Appointment savedNew = appointmentRepository.save(newAppointment);

        // Notify the other party
        UUID rescheduledBy = request.getRescheduledBy();
        UUID doctorUserId = oldAppointment.getDoctor().getUserId();
        UUID patientId = oldAppointment.getPatient().getId();
        boolean rescheduledByDoctor = rescheduledBy.equals(doctorUserId);

        UUID recipientId = rescheduledByDoctor ? patientId : doctorUserId;
        String reschedulerName = rescheduledByDoctor 
                ? "Dr. " + oldAppointment.getDoctor().getUser().getFullName()
                : oldAppointment.getPatient().getFullName();

        try {
            eventPublisher.publishEvent(new NotificationEvent(
                this,
                recipientId,
                "Appointment Rescheduled",
                String.format("Your appointment has been rescheduled by %s from %s at %s to %s at %s. Reason: %s",
                    reschedulerName,
                    oldAppointment.getAppointmentDate().toString(),
                    oldAppointment.getTimeSlot(),
                    savedNew.getAppointmentDate().toString(),
                    savedNew.getTimeSlot(),
                    request.getReason() != null ? request.getReason() : "No reason provided"),
                NotificationType.APPOINTMENT_RESCHEDULED,
                savedNew.getId().toString()
            ));
        } catch (Exception e) {
            System.err.println("Failed to publish reschedule notification: " + e.getMessage());
        }

        return mapToResponse(savedNew);
    }

    public List<AppointmentResponse> getAppointmentsByPatient(UUID patientId) {
        return appointmentRepository.findByPatientIdOrderByAppointmentDateDesc(patientId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<AppointmentResponse> getAppointmentsByDoctor(UUID doctorId) {
        return appointmentRepository.findByDoctorIdOrderByAppointmentDateDesc(doctorId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<AppointmentResponse> getAppointmentsByDoctorUserId(UUID userId) {
        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Doctor not found"));
        return getAppointmentsByDoctor(doctor.getId());
    }

    public AppointmentResponse getAppointmentById(UUID id) {
        Appointment appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));
        return mapToResponse(appointment);
    }


    private AppointmentResponse mapToResponse(Appointment appointment) {
        AppointmentResponse response = new AppointmentResponse();
        response.setId(appointment.getId());
        response.setDoctorId(appointment.getDoctor().getId());
        response.setDoctorName(appointment.getDoctor().getUser().getFullName());
        response.setPatientId(appointment.getPatient().getId());
        response.setPatientName(appointment.getPatient().getFullName());
        response.setAppointmentDate(appointment.getAppointmentDate());
        response.setTimeSlot(appointment.getTimeSlot());
        response.setStatus(appointment.getStatus().name());
        response.setCreatedAt(appointment.getCreatedAt());
        response.setCancellationReason(appointment.getCancellationReason());
        response.setCancelledBy(appointment.getCancelledBy());
        if (appointment.getRescheduledFrom() != null) {
            response.setRescheduledFromId(appointment.getRescheduledFrom().getId());
        }
        if (appointment.getConsultationType() != null) {
            response.setConsultationType(appointment.getConsultationType().name());
        }
        return response;
    }

    @Transactional
    public AppointmentResponse acceptReschedule(UUID id) {
        Appointment appointment = appointmentRepository.findByIdWithParties(id)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        if (appointment.getStatus() != AppointmentStatus.PENDING_RESCHEDULE) {
            throw new RuntimeException("Appointment is not pending reschedule");
        }

        AppointmentStatus prevStatus = appointment.getPreviousStatus();
        if (prevStatus == AppointmentStatus.CONFIRMED) {
            appointment.setStatus(AppointmentStatus.CONFIRMED);
            // Move payment record from old appointment to the new one
            if (appointment.getRescheduledFrom() != null) {
                eventPublisher.publishEvent(new RescheduleEvent(this, appointment.getRescheduledFrom().getId(), appointment.getId(), true));
            }
        } else {
            appointment.setStatus(AppointmentStatus.PENDING);
        }

        Appointment savedAppointment = appointmentRepository.save(appointment);

        // Notify the user who requested the reschedule
        UUID reschedulerId = appointment.getCancelledBy(); // stored who rescheduled it
        UUID doctorUserId = appointment.getDoctor().getUserId();
        UUID patientId = appointment.getPatient().getId();
        UUID recipientId = reschedulerId;

        try {
            eventPublisher.publishEvent(new NotificationEvent(
                this,
                recipientId,
                "Reschedule Request Accepted",
                String.format("Your request to reschedule the appointment with %s to %s at %s has been accepted.",
                    reschedulerId.equals(doctorUserId) ? appointment.getPatient().getFullName() : "Dr. " + appointment.getDoctor().getUser().getFullName(),
                    appointment.getAppointmentDate().toString(),
                    appointment.getTimeSlot()),
                NotificationType.APPOINTMENT_CONFIRMED,
                appointment.getId().toString()
            ));
        } catch (Exception e) {
            System.err.println("Failed to publish accept reschedule notification: " + e.getMessage());
        }

        return mapToResponse(savedAppointment);
    }

    @Transactional
    public AppointmentResponse rejectReschedule(UUID id) {
        Appointment appointment = appointmentRepository.findByIdWithParties(id)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        if (appointment.getStatus() != AppointmentStatus.PENDING_RESCHEDULE) {
            throw new RuntimeException("Appointment is not pending reschedule");
        }

        appointment.setStatus(AppointmentStatus.REJECTED);
        appointment.setCancellationReason("Reschedule request rejected by the other party.");
        Appointment savedAppointment = appointmentRepository.save(appointment);

        // Refund if the original was paid
        if (appointment.getPreviousStatus() == AppointmentStatus.CONFIRMED && appointment.getRescheduledFrom() != null) {
            try {
                eventPublisher.publishEvent(new RefundEvent(this, appointment.getRescheduledFrom().getId()));
            } catch (Exception e) {
                System.err.println("Failed to publish refund event: " + e.getMessage());
            }
        }

        // Notify the user who requested the reschedule
        UUID reschedulerId = appointment.getCancelledBy();
        UUID doctorUserId = appointment.getDoctor().getUserId();
        UUID patientId = appointment.getPatient().getId();
        UUID recipientId = reschedulerId;

        try {
            eventPublisher.publishEvent(new NotificationEvent(
                this,
                recipientId,
                "Reschedule Request Rejected",
                String.format("Your request to reschedule the appointment with %s to %s at %s was rejected. A refund will be initiated if applicable.",
                    reschedulerId.equals(doctorUserId) ? appointment.getPatient().getFullName() : "Dr. " + appointment.getDoctor().getUser().getFullName(),
                    appointment.getAppointmentDate().toString(),
                    appointment.getTimeSlot()),
                NotificationType.APPOINTMENT_REJECTED,
                appointment.getId().toString()
            ));
        } catch (Exception e) {
            System.err.println("Failed to publish reject reschedule notification: " + e.getMessage());
        }

        return mapToResponse(savedAppointment);
    }
}
