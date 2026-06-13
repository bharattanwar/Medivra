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

        Appointment appointment = new Appointment();
        appointment.setDoctor(doctor);
        appointment.setPatient(patient);
        appointment.setAppointmentDate(request.getAppointmentDate());
        appointment.setTimeSlot(request.getTimeSlot());
        appointment.setStatus(AppointmentStatus.PENDING);

        Appointment savedAppointment = appointmentRepository.save(appointment);

        // Publish appointment booked notification for the Doctor
        try {
            eventPublisher.publishEvent(new NotificationEvent(
                this,
                doctor.getUserId(),
                "New Appointment Request",
                String.format("You have a new appointment booking request from %s for %s at %s.", 
                    patient.getFullName(), 
                    savedAppointment.getAppointmentDate().toString(), 
                    savedAppointment.getTimeSlot()),
                NotificationType.APPOINTMENT_BOOKED,
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

        // If the old appointment was CONFIRMED (paid), the new one is also CONFIRMED
        if (currentStatus == AppointmentStatus.CONFIRMED) {
            newAppointment.setStatus(AppointmentStatus.CONFIRMED);
        } else {
            newAppointment.setStatus(AppointmentStatus.PENDING);
        }

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
        return response;
    }
}
