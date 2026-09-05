package com.app.appointment.service;

import com.app.appointment.dto.AppointmentRequest;
import com.app.appointment.dto.AppointmentResponse;
import com.app.appointment.dto.CancelAppointmentRequest;
import com.app.appointment.dto.RescheduleAppointmentRequest;
import com.app.appointment.entity.Appointment;
import com.app.appointment.entity.AppointmentStatus;
import com.app.appointment.entity.ConsultationType;
import com.app.appointment.repository.AppointmentRepository;
import com.app.common.entity.NotificationType;
import com.app.common.event.InClinicBookingEvent;
import com.app.common.event.NotificationEvent;
import com.app.common.event.RefundEvent;
import com.app.common.event.RescheduleEvent;
import com.app.doctor.entity.Doctor;
import com.app.doctor.repository.DoctorRepository;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Core appointment lifecycle service.
 *
 * Covers booking, cancellation, rejection, and rescheduling.
 * Each mutation publishes Spring application events so the notification
 * and payment modules can react without tight coupling.
 *
 * Booking rules enforced here:
 *   - Patients are blocked for 24 h after 4+ booking attempts in one day (spam guard).
 *   - A doctor must support the requested consultation type (in-clinic / video).
 *   - Cancellation / rescheduling require at least 1 day's notice.
 */
@Service
public class AppointmentService {

    private static final Logger log = LoggerFactory.getLogger(AppointmentService.class);

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

        // Lift an expired block before checking
        if (Boolean.TRUE.equals(patient.isBlocked())) {
            if (patient.getBlockedUntil() != null
                    && LocalDateTime.now().isAfter(patient.getBlockedUntil())) {
                patient.setBlocked(false);
                patient.setBlockedUntil(null);
                userRepository.save(patient);
            } else {
                throw new RuntimeException("Your account is currently blocked.");
            }
        }

        // Spam guard: block the patient if they create ≥ 4 appointments today
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = LocalDate.now().atTime(23, 59, 59, 999_999_999);
        long appointmentsToday = appointmentRepository
                .countAppointmentsForPatientToday(patient.getId(), startOfDay, endOfDay);
        if (appointmentsToday >= 4) {
            patient.setBlocked(true);
            patient.setBlockedUntil(LocalDateTime.now().plusHours(24));
            userRepository.save(patient);
            throw new RuntimeException(
                    "Your account has been blocked for 24 hours due to excessive booking attempts.");
        }

        // Validate that the doctor supports the requested consultation mode
        ConsultationType consultationType = request.getConsultationType();
        if (consultationType == ConsultationType.IN_CLINIC
                && !Boolean.TRUE.equals(doctor.getAvailableInClinic())) {
            throw new RuntimeException("This doctor is not available for in-clinic consultations.");
        }
        if (consultationType == ConsultationType.ONLINE
                && !Boolean.TRUE.equals(doctor.getAvailableVideo())) {
            throw new RuntimeException("This doctor is not available for video consultations.");
        }

        Appointment appointment = new Appointment();
        appointment.setDoctor(doctor);
        appointment.setPatient(patient);
        appointment.setAppointmentDate(request.getAppointmentDate());
        appointment.setTimeSlot(request.getTimeSlot());
        appointment.setConsultationType(consultationType);

        // In-clinic appointments go straight to CONFIRMED (pay at clinic);
        // online appointments stay PENDING until the patient pays online.
        appointment.setStatus(consultationType == ConsultationType.IN_CLINIC
                ? AppointmentStatus.CONFIRMED
                : AppointmentStatus.PENDING);

        Appointment saved = appointmentRepository.save(appointment);

        // For in-clinic bookings, tell the payment module to create a pending record
        if (consultationType == ConsultationType.IN_CLINIC) {
            BigDecimal fee = doctor.getConsultationFee() != null
                    ? doctor.getConsultationFee()
                    : BigDecimal.valueOf(500);
            publishEvent(new InClinicBookingEvent(this, saved.getId(), fee),
                    "InClinicBookingEvent");
        }

        // Notify the doctor immediately for confirmed in-clinic bookings (pay at clinic).
        // For online video consultations, the doctor is notified after successful payment verification in PaymentService.
        if (consultationType == ConsultationType.IN_CLINIC) {
            publishEvent(new NotificationEvent(
                    this,
                    doctor.getUserId(),
                    "New In-Clinic Consultation Booked",
                    String.format("You have a new in-clinic (pay at clinic) booking from %s for %s at %s.",
                            patient.getFullName(),
                            saved.getAppointmentDate(),
                            saved.getTimeSlot()),
                    NotificationType.APPOINTMENT_CONFIRMED,
                    saved.getId().toString()
            ), "AppointmentBooked notification");
        }

        return mapToResponse(saved);
    }

    @Transactional
    public AppointmentResponse cancelAppointment(UUID id, CancelAppointmentRequest request) {
        Appointment appointment = appointmentRepository.findByIdWithParties(id)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        AppointmentStatus currentStatus = appointment.getStatus();
        if (currentStatus != AppointmentStatus.PENDING
                && currentStatus != AppointmentStatus.CONFIRMED) {
            throw new RuntimeException(
                    "Only PENDING or CONFIRMED appointments can be cancelled. Current: " + currentStatus);
        }

        // Must cancel at least 1 day before the appointment
        if (!appointment.getAppointmentDate().isAfter(LocalDate.now())) {
            throw new RuntimeException(
                    "Cancellation is only allowed at least a day before the consultation date.");
        }

        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointment.setCancellationReason(request.getReason());
        appointment.setCancelledBy(request.getCancelledBy());
        appointmentRepository.save(appointment);

        // If the appointment was already confirmed (paid), trigger a refund
        if (currentStatus == AppointmentStatus.CONFIRMED) {
            publishEvent(new RefundEvent(this, id), "RefundEvent");
        }

        // Notify the other party
        UUID cancelledBy = request.getCancelledBy();
        UUID doctorUserId = appointment.getDoctor().getUserId();
        boolean cancelledByDoctor = cancelledBy.equals(doctorUserId);
        UUID recipientId = cancelledByDoctor
                ? appointment.getPatient().getId()
                : doctorUserId;
        String cancellerName = cancelledByDoctor
                ? "Dr. " + appointment.getDoctor().getUser().getFullName()
                : appointment.getPatient().getFullName();

        publishEvent(new NotificationEvent(
                this, recipientId, "Appointment Cancelled",
                String.format("Your appointment on %s at %s has been cancelled by %s. Reason: %s",
                        appointment.getAppointmentDate(), appointment.getTimeSlot(),
                        cancellerName,
                        request.getReason() != null ? request.getReason() : "No reason provided"),
                NotificationType.APPOINTMENT_CANCELLED,
                appointment.getId().toString()
        ), "Cancellation notification");

        return mapToResponse(appointment);
    }

    @Transactional
    public AppointmentResponse rejectAppointment(UUID id, CancelAppointmentRequest request) {
        Appointment appointment = appointmentRepository.findByIdWithParties(id)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        if (appointment.getStatus() != AppointmentStatus.PENDING) {
            throw new RuntimeException(
                    "Only PENDING appointments can be rejected. Current: " + appointment.getStatus());
        }

        appointment.setStatus(AppointmentStatus.REJECTED);
        appointment.setCancellationReason(request.getReason());
        appointment.setCancelledBy(request.getCancelledBy());
        appointmentRepository.save(appointment);

        publishEvent(new NotificationEvent(
                this,
                appointment.getPatient().getId(),
                "Appointment Rejected",
                String.format("Dr. %s has declined your appointment for %s at %s. Reason: %s",
                        appointment.getDoctor().getUser().getFullName(),
                        appointment.getAppointmentDate(), appointment.getTimeSlot(),
                        request.getReason() != null ? request.getReason() : "No reason provided"),
                NotificationType.APPOINTMENT_REJECTED,
                appointment.getId().toString()
        ), "Rejection notification");

        return mapToResponse(appointment);
    }

    @Transactional
    public AppointmentResponse rescheduleAppointment(UUID id, RescheduleAppointmentRequest request) {
        Appointment oldAppointment = appointmentRepository.findByIdWithParties(id)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        AppointmentStatus currentStatus = oldAppointment.getStatus();
        if (currentStatus != AppointmentStatus.PENDING
                && currentStatus != AppointmentStatus.CONFIRMED) {
            throw new RuntimeException(
                    "Only PENDING or CONFIRMED appointments can be rescheduled. Current: " + currentStatus);
        }

        if (!oldAppointment.getAppointmentDate().isAfter(LocalDate.now())) {
            throw new RuntimeException(
                    "Rescheduling is only allowed at least a day before the consultation date.");
        }

        // Check/lift patient block
        User patient = oldAppointment.getPatient();
        if (Boolean.TRUE.equals(patient.isBlocked())) {
            if (patient.getBlockedUntil() != null
                    && LocalDateTime.now().isAfter(patient.getBlockedUntil())) {
                patient.setBlocked(false);
                patient.setBlockedUntil(null);
                userRepository.save(patient);
            } else {
                throw new RuntimeException("Your account is currently blocked.");
            }
        }

        // Mark the old appointment as rescheduled
        oldAppointment.setStatus(AppointmentStatus.RESCHEDULED);
        oldAppointment.setCancellationReason(
                "Rescheduled: " + (request.getReason() != null ? request.getReason() : "No reason provided"));
        oldAppointment.setCancelledBy(request.getRescheduledBy());
        appointmentRepository.save(oldAppointment);

        // Create a new appointment for the new date/time
        Appointment newAppointment = new Appointment();
        newAppointment.setDoctor(oldAppointment.getDoctor());
        newAppointment.setPatient(oldAppointment.getPatient());
        newAppointment.setAppointmentDate(request.getNewDate());
        newAppointment.setTimeSlot(request.getNewTimeSlot());
        newAppointment.setRescheduledFrom(oldAppointment);
        newAppointment.setPreviousStatus(currentStatus);
        newAppointment.setStatus(AppointmentStatus.PENDING_RESCHEDULE);
        newAppointment.setCancelledBy(request.getRescheduledBy());
        newAppointment.setCancellationReason(
                request.getReason() != null ? request.getReason() : "No reason provided");
        Appointment savedNew = appointmentRepository.save(newAppointment);

        // Notify the other party
        UUID rescheduledBy = request.getRescheduledBy();
        UUID doctorUserId = oldAppointment.getDoctor().getUserId();
        boolean rescheduledByDoctor = rescheduledBy.equals(doctorUserId);
        UUID recipientId = rescheduledByDoctor
                ? oldAppointment.getPatient().getId()
                : doctorUserId;
        String reschedulerName = rescheduledByDoctor
                ? "Dr. " + oldAppointment.getDoctor().getUser().getFullName()
                : oldAppointment.getPatient().getFullName();

        publishEvent(new NotificationEvent(
                this, recipientId, "Appointment Rescheduled",
                String.format(
                        "Your appointment has been rescheduled by %s from %s at %s to %s at %s. Reason: %s",
                        reschedulerName,
                        oldAppointment.getAppointmentDate(), oldAppointment.getTimeSlot(),
                        savedNew.getAppointmentDate(), savedNew.getTimeSlot(),
                        request.getReason() != null ? request.getReason() : "No reason provided"),
                NotificationType.APPOINTMENT_RESCHEDULED,
                savedNew.getId().toString()
        ), "Reschedule notification");

        return mapToResponse(savedNew);
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
            // Migrate the payment record from the old appointment to this new one
            if (appointment.getRescheduledFrom() != null) {
                publishEvent(new RescheduleEvent(
                        this,
                        appointment.getRescheduledFrom().getId(),
                        appointment.getId(),
                        true
                ), "RescheduleEvent");
            }
        } else {
            appointment.setStatus(AppointmentStatus.PENDING);
        }

        Appointment saved = appointmentRepository.save(appointment);

        UUID reschedulerId = appointment.getCancelledBy();
        UUID doctorUserId = appointment.getDoctor().getUserId();
        String otherPartyName = reschedulerId.equals(doctorUserId)
                ? appointment.getPatient().getFullName()
                : "Dr. " + appointment.getDoctor().getUser().getFullName();

        publishEvent(new NotificationEvent(
                this, reschedulerId, "Reschedule Request Accepted",
                String.format("Your request to reschedule the appointment with %s to %s at %s has been accepted.",
                        otherPartyName,
                        appointment.getAppointmentDate(), appointment.getTimeSlot()),
                NotificationType.APPOINTMENT_CONFIRMED,
                appointment.getId().toString()
        ), "AcceptReschedule notification");

        return mapToResponse(saved);
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
        Appointment saved = appointmentRepository.save(appointment);

        // Refund the original paid appointment if applicable
        if (appointment.getPreviousStatus() == AppointmentStatus.CONFIRMED
                && appointment.getRescheduledFrom() != null) {
            publishEvent(new RefundEvent(this, appointment.getRescheduledFrom().getId()),
                    "RefundEvent on reschedule rejection");
        }

        UUID reschedulerId = appointment.getCancelledBy();
        UUID doctorUserId = appointment.getDoctor().getUserId();
        String otherPartyName = reschedulerId.equals(doctorUserId)
                ? appointment.getPatient().getFullName()
                : "Dr. " + appointment.getDoctor().getUser().getFullName();

        publishEvent(new NotificationEvent(
                this, reschedulerId, "Reschedule Request Rejected",
                String.format(
                        "Your request to reschedule with %s to %s at %s was rejected. "
                                + "A refund will be initiated if applicable.",
                        otherPartyName,
                        appointment.getAppointmentDate(), appointment.getTimeSlot()),
                NotificationType.APPOINTMENT_REJECTED,
                appointment.getId().toString()
        ), "RejectReschedule notification");

        return mapToResponse(saved);
    }

    @Transactional
    public AppointmentResponse completeAppointment(UUID id, UUID requestedByUserId) {
        Appointment appointment = appointmentRepository.findByIdWithParties(id)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        AppointmentStatus currentStatus = appointment.getStatus();
        if (currentStatus != AppointmentStatus.CONFIRMED && currentStatus != AppointmentStatus.IN_PROGRESS) {
            throw new RuntimeException(
                    "Only CONFIRMED or IN_PROGRESS appointments can be completed. Current: " + currentStatus);
        }

        // Only the doctor on this appointment may complete it
        UUID doctorUserId = appointment.getDoctor().getUserId();
        if (!doctorUserId.equals(requestedByUserId)) {
            throw new RuntimeException("Only the assigned doctor can mark this appointment as completed.");
        }

        appointment.setStatus(AppointmentStatus.COMPLETED);
        Appointment saved = appointmentRepository.save(appointment);

        // Notify the patient that their consultation is complete
        publishEvent(new NotificationEvent(
                this,
                appointment.getPatient().getId(),
                "Consultation Completed",
                String.format("Your consultation with Dr. %s on %s at %s has been marked as completed.",
                        appointment.getDoctor().getUser().getFullName(),
                        appointment.getAppointmentDate(),
                        appointment.getTimeSlot()),
                NotificationType.APPOINTMENT_COMPLETED,
                saved.getId().toString()
        ), "AppointmentCompleted notification");

        return mapToResponse(saved);
    }

    /**
     * Auto-completes a video consultation when both participants have left the room.
     * Called internally by VideoSignalingController — does NOT check who is calling,
     * since this is a system-triggered action (not user-triggered).
     */
    @Transactional
    public void autoCompleteVideoConsultation(UUID appointmentId) {
        appointmentRepository.findByIdWithParties(appointmentId).ifPresent(appointment -> {
            AppointmentStatus status = appointment.getStatus();
            if (status != AppointmentStatus.CONFIRMED && status != AppointmentStatus.IN_PROGRESS) {
                log.info("Skipping auto-complete for appointment {} — status is {}", appointmentId, status);
                return;
            }
            if (appointment.getConsultationType() != com.app.appointment.entity.ConsultationType.ONLINE) {
                log.info("Skipping auto-complete for appointment {} — not an ONLINE consultation", appointmentId);
                return;
            }

            appointment.setStatus(AppointmentStatus.COMPLETED);
            appointmentRepository.save(appointment);
            log.info("Auto-completed video consultation for appointment {}", appointmentId);

            publishEvent(new NotificationEvent(
                    this,
                    appointment.getPatient().getId(),
                    "Consultation Completed",
                    String.format("Your video consultation with Dr. %s on %s at %s has been completed. Thank you!",
                            appointment.getDoctor().getUser().getFullName(),
                            appointment.getAppointmentDate(),
                            appointment.getTimeSlot()),
                    NotificationType.APPOINTMENT_COMPLETED,
                    appointmentId.toString()
            ), "AutoComplete notification to patient");

            publishEvent(new NotificationEvent(
                    this,
                    appointment.getDoctor().getUserId(),
                    "Consultation Completed",
                    String.format("Your video consultation with %s on %s at %s has been marked as completed.",
                            appointment.getPatient().getFullName(),
                            appointment.getAppointmentDate(),
                            appointment.getTimeSlot()),
                    NotificationType.APPOINTMENT_COMPLETED,
                    appointmentId.toString()
            ), "AutoComplete notification to doctor");
        });
    }

    // ── Query methods ────────────────────────────────────────────────────────

    public List<AppointmentResponse> getAppointmentsByPatient(UUID patientId) {
        return appointmentRepository.findByPatientIdOrderByAppointmentDateDesc(patientId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    public List<AppointmentResponse> getAppointmentsByDoctor(UUID doctorId) {
        return appointmentRepository.findByDoctorIdOrderByAppointmentDateDesc(doctorId)
                .stream()
                .filter(a -> a.getStatus() != AppointmentStatus.PENDING || a.getConsultationType() == ConsultationType.IN_CLINIC)
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

    public List<String> getBookedSlots(UUID doctorId, LocalDate date) {
        return appointmentRepository.findBookedSlotsByDoctorAndDate(doctorId, date);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /** Map an Appointment entity to the response DTO the frontend expects. */
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

    /**
     * Publish a Spring application event, swallowing and logging any exception
     * so that event delivery failures never roll back the main transaction.
     */
    private void publishEvent(Object event, String eventName) {
        try {
            eventPublisher.publishEvent(event);
        } catch (Exception e) {
            log.warn("Failed to publish {}: {}", eventName, e.getMessage());
        }
    }
}
