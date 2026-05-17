package com.app.appointment.controller;

import com.app.appointment.dto.AppointmentRequest;
import com.app.appointment.dto.AppointmentResponse;
import com.app.appointment.service.AppointmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
}
