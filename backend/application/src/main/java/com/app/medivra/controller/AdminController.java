package com.app.medivra.controller;

import com.app.appointment.entity.Appointment;
import com.app.appointment.entity.AppointmentStatus;
import com.app.appointment.repository.AppointmentRepository;
import com.app.common.dto.ApiResponse;
import com.app.doctor.entity.Doctor;
import com.app.doctor.repository.DoctorRepository;
import com.app.payment.entity.Payment;
import com.app.payment.entity.PaymentStatus;
import com.app.payment.repository.PaymentRepository;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository userRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final PaymentRepository paymentRepository;

    public AdminController(UserRepository userRepository,
                           DoctorRepository doctorRepository,
                           AppointmentRepository appointmentRepository,
                           PaymentRepository paymentRepository) {
        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentRepository = appointmentRepository;
        this.paymentRepository = paymentRepository;
    }

    // Records for response mapping to avoid heavy boilerplates
    public record AdminAnalytics(
            long totalPatients,
            long totalDoctors,
            long pendingDoctors,
            long totalAppointments,
            long completedAppointments,
            long cancelledAppointments,
            BigDecimal totalRevenue
    ) {}

    public record AdminUserResponse(
            UUID id,
            String fullName,
            String email,
            String role,
            boolean isBlocked
    ) {}

    public record AdminDoctorResponse(
            UUID id,
            UUID userId,
            String fullName,
            String email,
            String specialization,
            String licenseNumber,
            Integer experienceYears,
            BigDecimal consultationFee,
            String hospitalName,
            String city,
            Boolean isApproved,
            Double rating
    ) {}

    public record AdminAppointmentResponse(
            UUID id,
            String patientName,
            String patientEmail,
            String doctorName,
            String doctorEmail,
            String date,
            String slot,
            String status,
            BigDecimal amount,
            String paymentStatus
    ) {}

    @GetMapping("/analytics")
    public ResponseEntity<ApiResponse<AdminAnalytics>> getAnalytics() {
        long totalPatients = userRepository.findAll().stream()
                .filter(u -> "PATIENT".equalsIgnoreCase(u.getRole()))
                .count();

        long totalDoctors = doctorRepository.count();

        long pendingDoctors = doctorRepository.findAll().stream()
                .filter(d -> !Boolean.TRUE.equals(d.isApproved()))
                .count();

        long totalAppointments = appointmentRepository.count();

        long completedAppointments = appointmentRepository.findAll().stream()
                .filter(a -> a.getStatus() == AppointmentStatus.COMPLETED)
                .count();

        long cancelledAppointments = appointmentRepository.findAll().stream()
                .filter(a -> a.getStatus() == AppointmentStatus.CANCELLED)
                .count();

        BigDecimal totalRevenue = paymentRepository.findAll().stream()
                .filter(p -> p.getPaymentStatus() == PaymentStatus.PAID)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        AdminAnalytics analytics = new AdminAnalytics(
                totalPatients,
                totalDoctors,
                pendingDoctors,
                totalAppointments,
                completedAppointments,
                cancelledAppointments,
                totalRevenue
        );

        return ResponseEntity.ok(ApiResponse.success(analytics, "Analytics retrieved successfully"));
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<AdminUserResponse>>> getAllUsers() {
        List<AdminUserResponse> users = userRepository.findAll().stream()
                .map(u -> new AdminUserResponse(
                        u.getId(),
                        u.getFullName(),
                        u.getEmail(),
                        u.getRole(),
                        Boolean.TRUE.equals(u.isBlocked())
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(users, "Users retrieved successfully"));
    }

    @PutMapping("/users/{userId}/block")
    public ResponseEntity<ApiResponse<Void>> toggleBlockUser(@PathVariable UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Do not allow blocking self/admin
        if ("ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new RuntimeException("Cannot block administrator accounts");
        }

        user.setBlocked(!Boolean.TRUE.equals(user.isBlocked()));
        userRepository.save(user);

        String message = Boolean.TRUE.equals(user.isBlocked()) ? "User blocked successfully" : "User unblocked successfully";
        return ResponseEntity.ok(ApiResponse.success(null, message));
    }

    @GetMapping("/doctors")
    public ResponseEntity<ApiResponse<List<AdminDoctorResponse>>> getAllDoctors() {
        List<AdminDoctorResponse> doctors = doctorRepository.findAll().stream()
                .map(d -> {
                    User user = userRepository.findById(d.getUserId()).orElse(null);
                    String fullName = user != null ? user.getFullName() : "Unknown";
                    String email = user != null ? user.getEmail() : d.getEmail();

                    return new AdminDoctorResponse(
                            d.getId(),
                            d.getUserId(),
                            fullName,
                            email,
                            d.getSpecialization(),
                            d.getLicenseNumber(),
                            d.getExperienceYears(),
                            d.getConsultationFee(),
                            d.getHospitalName(),
                            d.getCity(),
                            Boolean.TRUE.equals(d.isApproved()),
                            d.getRating()
                    );
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(doctors, "Doctors list retrieved successfully"));
    }

    @PutMapping("/doctors/{doctorId}/approve")
    public ResponseEntity<ApiResponse<Void>> toggleApproveDoctor(@PathVariable UUID doctorId) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor profile not found"));

        doctor.setApproved(!Boolean.TRUE.equals(doctor.isApproved()));
        doctorRepository.save(doctor);

        String message = Boolean.TRUE.equals(doctor.isApproved()) ? "Doctor profile approved" : "Doctor profile marked as pending";
        return ResponseEntity.ok(ApiResponse.success(null, message));
    }

    @GetMapping("/appointments")
    public ResponseEntity<ApiResponse<List<AdminAppointmentResponse>>> getAllAppointments() {
        List<AdminAppointmentResponse> appointments = appointmentRepository.findAll().stream()
                .map(a -> {
                    String patientName = a.getPatient() != null ? a.getPatient().getFullName() : "Unknown";
                    String patientEmail = a.getPatient() != null ? a.getPatient().getEmail() : "Unknown";

                    String doctorName = "Unknown";
                    String doctorEmail = "Unknown";

                    if (a.getDoctor() != null) {
                        UUID doctorUserId = a.getDoctor().getUserId();
                        User doctorUser = userRepository.findById(doctorUserId).orElse(null);
                        doctorName = doctorUser != null ? doctorUser.getFullName() : "Unknown";
                        doctorEmail = doctorUser != null ? doctorUser.getEmail() : a.getDoctor().getEmail();
                    }

                    // Fetch payment details
                    Payment payment = paymentRepository.findByAppointmentId(a.getId()).orElse(null);
                    BigDecimal amount = payment != null ? payment.getAmount() : (a.getDoctor() != null ? a.getDoctor().getConsultationFee() : BigDecimal.ZERO);
                    String paymentStatus = payment != null ? payment.getPaymentStatus().name() : "UNPAID";

                    return new AdminAppointmentResponse(
                            a.getId(),
                            patientName,
                            patientEmail,
                            doctorName,
                            doctorEmail,
                            a.getAppointmentDate().toString(),
                            a.getTimeSlot(),
                            a.getStatus().name(),
                            amount,
                            paymentStatus
                    );
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(appointments, "Appointments retrieved successfully"));
    }
}
