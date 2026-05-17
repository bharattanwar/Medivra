package com.app.payment.controller;

import com.app.payment.dto.*;
import com.app.payment.service.PaymentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/create-order")
    public ResponseEntity<CreateOrderResponse> createOrder(@Valid @RequestBody CreateOrderRequest request) {
        return ResponseEntity.ok(paymentService.createOrder(request));
    }

    @PostMapping("/verify")
    public ResponseEntity<PaymentResponse> verifyPayment(@Valid @RequestBody VerifyPaymentRequest request) {
        return ResponseEntity.ok(paymentService.verifyPayment(request));
    }

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<PaymentResponse>> getPaymentHistory(@PathVariable UUID patientId) {
        return ResponseEntity.ok(paymentService.getPaymentHistory(patientId));
    }

    @GetMapping("/appointment/{appointmentId}")
    public ResponseEntity<PaymentResponse> getPaymentByAppointment(@PathVariable UUID appointmentId) {
        return ResponseEntity.ok(paymentService.getPaymentByAppointment(appointmentId));
    }

    @GetMapping("/{paymentId}/invoice")
    public ResponseEntity<InvoiceResponse> getInvoice(@PathVariable UUID paymentId) {
        return ResponseEntity.ok(paymentService.getInvoice(paymentId));
    }

    @PostMapping("/{paymentId}/refund")
    public ResponseEntity<PaymentResponse> initiateRefund(@PathVariable UUID paymentId) {
        return ResponseEntity.ok(paymentService.initiateRefund(paymentId));
    }
}
