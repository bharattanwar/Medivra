package com.app.appointment.controller;

import com.app.appointment.dto.AppointmentRequest;
import com.app.appointment.dto.AppointmentResponse;
import com.app.appointment.dto.CancelAppointmentRequest;
import com.app.appointment.dto.RescheduleAppointmentRequest;
import com.app.appointment.service.AppointmentService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {

    private final AppointmentService appointmentService;

    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @PostMapping
    public ResponseEntity<AppointmentResponse> bookAppointment(@RequestBody AppointmentRequest request) {
        return ResponseEntity.ok(appointmentService.bookAppointment(request));
    }

    @GetMapping("/patient/{id}")
    public ResponseEntity<List<AppointmentResponse>> getAppointmentsByPatient(@PathVariable UUID id) {
        return ResponseEntity.ok(appointmentService.getAppointmentsByPatient(id));
    }

    @GetMapping("/doctor/{id}")
    public ResponseEntity<List<AppointmentResponse>> getAppointmentsByDoctor(@PathVariable UUID id) {
        return ResponseEntity.ok(appointmentService.getAppointmentsByDoctor(id));
    }

    @GetMapping("/doctor/userId/{userId}")
    public ResponseEntity<List<AppointmentResponse>> getAppointmentsByDoctorUserId(@PathVariable UUID userId) {
        return ResponseEntity.ok(appointmentService.getAppointmentsByDoctorUserId(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AppointmentResponse> getAppointmentById(@PathVariable UUID id) {
        return ResponseEntity.ok(appointmentService.getAppointmentById(id));
    }

    @GetMapping("/doctor/{doctorId}/booked-slots")
    public ResponseEntity<List<String>> getBookedSlots(
            @PathVariable UUID doctorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(appointmentService.getBookedSlots(doctorId, date));
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<AppointmentResponse> cancelAppointment(
            @PathVariable UUID id,
            @RequestBody CancelAppointmentRequest request) {
        return ResponseEntity.ok(appointmentService.cancelAppointment(id, request));
    }

    @PutMapping("/{id}/reject")
    public ResponseEntity<AppointmentResponse> rejectAppointment(
            @PathVariable UUID id,
            @RequestBody CancelAppointmentRequest request) {
        return ResponseEntity.ok(appointmentService.rejectAppointment(id, request));
    }

    @PutMapping("/{id}/reschedule")
    public ResponseEntity<AppointmentResponse> rescheduleAppointment(
            @PathVariable UUID id,
            @RequestBody RescheduleAppointmentRequest request) {
        return ResponseEntity.ok(appointmentService.rescheduleAppointment(id, request));
    }

    @PutMapping("/{id}/reschedule/accept")
    public ResponseEntity<AppointmentResponse> acceptReschedule(@PathVariable UUID id) {
        return ResponseEntity.ok(appointmentService.acceptReschedule(id));
    }

    @PutMapping("/{id}/reschedule/reject")
    public ResponseEntity<AppointmentResponse> rejectReschedule(@PathVariable UUID id) {
        return ResponseEntity.ok(appointmentService.rejectReschedule(id));
    }
}
