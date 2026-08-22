package com.app.payment.service;

import com.app.appointment.entity.Appointment;
import com.app.appointment.entity.AppointmentStatus;
import com.app.appointment.repository.AppointmentRepository;
import com.app.chat.service.ChatService;
import com.app.common.entity.NotificationType;
import com.app.common.event.NotificationEvent;
import com.app.payment.config.RazorpayProperties;
import com.app.payment.dto.CreateOrderRequest;
import com.app.payment.dto.CreateOrderResponse;
import com.app.payment.dto.InvoiceResponse;
import com.app.payment.dto.PaymentResponse;
import com.app.payment.dto.VerifyPaymentRequest;
import com.app.payment.entity.Payment;
import com.app.payment.entity.PaymentStatus;
import com.app.payment.entity.RefundStatus;
import com.app.payment.repository.PaymentRepository;
import com.razorpay.Order;
import com.razorpay.Refund;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service managing appointment payments, Razorpay order creation,
 * signature verification, refunds, and invoice generation.
 *
 * Workflow:
 * 1. createOrder: Generates a gateway order (Razorpay or mock) for the appointment consultation fee.
 * 2. verifyPayment: Validates Razorpay signature / transaction ID, transitions payment to PAID,
 *    confirms the appointment, initializes consultation chat, and sends notifications.
 * 3. initiateRefund: Processes refunds through Razorpay API when appointments are cancelled.
 * 4. getInvoice: Produces structured invoice details for completed transactions.
 */
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository paymentRepository;
    private final AppointmentRepository appointmentRepository;
    private final RazorpayService razorpayService;
    private final RazorpayProperties razorpayProperties;
    private final ChatService chatService;
    private final ApplicationEventPublisher eventPublisher;

    public PaymentService(PaymentRepository paymentRepository,
                          AppointmentRepository appointmentRepository,
                          RazorpayService razorpayService,
                          RazorpayProperties razorpayProperties,
                          ChatService chatService,
                          ApplicationEventPublisher eventPublisher) {
        this.paymentRepository = paymentRepository;
        this.appointmentRepository = appointmentRepository;
        this.razorpayService = razorpayService;
        this.razorpayProperties = razorpayProperties;
        this.chatService = chatService;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Prepares a payment order for an appointment. Supports both live Razorpay
     * gateway integration and mock sandbox mode for local development.
     */
    @Transactional
    public CreateOrderResponse createOrder(CreateOrderRequest request) {
        Appointment appointment = appointmentRepository.findById(request.getAppointmentId())
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        if (!appointment.getPatient().getId().equals(request.getPatientId())) {
            throw new RuntimeException("Unauthorized payment for this appointment");
        }

        if (appointment.getStatus() != AppointmentStatus.PENDING) {
            throw new RuntimeException("Appointment is not awaiting payment");
        }

        BigDecimal consultationFee = appointment.getDoctor().getConsultationFee();
        final BigDecimal amount = (consultationFee == null || consultationFee.compareTo(BigDecimal.ZERO) <= 0)
                ? BigDecimal.valueOf(500)
                : consultationFee;

        Payment payment = paymentRepository.findByAppointmentId(appointment.getId())
                .orElseGet(() -> {
                    Payment p = new Payment();
                    p.setAppointment(appointment);
                    p.setAmount(amount);
                    p.setPaymentStatus(PaymentStatus.PENDING);
                    return p;
                });

        payment.setAmount(amount);

        CreateOrderResponse response = new CreateOrderResponse();
        response.setPaymentId(payment.getId());
        response.setAmount(amount);
        response.setAmountPaise(razorpayService.toPaise(amount));
        response.setCurrency("INR");

        if (razorpayService.isLiveMode()) {
            try {
                Order order = razorpayService.createOrder(amount, appointment.getId());
                payment.setRazorpayOrderId(order.get("id"));
                payment.setPaymentStatus(PaymentStatus.ORDER_CREATED);
                paymentRepository.save(payment);

                response.setOrderId(order.get("id"));
                response.setKeyId(razorpayProperties.getKeyId());
                response.setPaymentId(payment.getId());
                response.setMockMode(false);
            } catch (Exception e) {
                log.error("Razorpay order creation failed: {}", e.getMessage(), e);
                throw new RuntimeException("Failed to create Razorpay order: " + e.getMessage(), e);
            }
        } else {
            String mockOrderId = razorpayService.createMockOrderId();
            payment.setRazorpayOrderId(mockOrderId);
            payment.setPaymentStatus(PaymentStatus.ORDER_CREATED);
            paymentRepository.save(payment);

            response.setOrderId(mockOrderId);
            response.setKeyId("mock_key");
            response.setPaymentId(payment.getId());
            response.setMockMode(true);
        }

        return response;
    }

    /**
     * Verifies payment completion via signature verification. Confirms appointment,
     * provisions real-time chat room, and dispatches confirmation events.
     */
    @Transactional
    public PaymentResponse verifyPayment(VerifyPaymentRequest request) {
        Appointment appointment = appointmentRepository.findById(request.getAppointmentId())
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        Payment payment = paymentRepository.findByAppointmentId(appointment.getId())
                .orElseThrow(() -> new RuntimeException("Payment record not found"));

        if (payment.getPaymentStatus() == PaymentStatus.PAID) {
            return mapToResponse(payment);
        }

        if (!payment.getRazorpayOrderId().equals(request.getRazorpayOrderId())) {
            throw new RuntimeException("Order ID mismatch");
        }

        boolean verified;
        if (razorpayService.isLiveMode()) {
            if (request.getRazorpaySignature() == null || request.getRazorpaySignature().isBlank()) {
                throw new RuntimeException("Payment signature is required");
            }
            verified = razorpayService.verifySignature(
                    request.getRazorpayOrderId(),
                    request.getRazorpayPaymentId(),
                    request.getRazorpaySignature());
        } else {
            verified = request.getRazorpayPaymentId() != null && !request.getRazorpayPaymentId().isBlank();
        }

        if (!verified) {
            payment.setPaymentStatus(PaymentStatus.FAILED);
            paymentRepository.save(payment);
            throw new RuntimeException("Payment verification failed");
        }

        payment.setPaymentId(request.getRazorpayPaymentId());
        payment.setMethod(request.getMethod() != null ? request.getMethod() : "razorpay");
        payment.setPaymentStatus(PaymentStatus.PAID);
        payment.setInvoiceNumber(generateInvoiceNumber());
        paymentRepository.save(payment);

        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointmentRepository.save(appointment);

        // Provision chat channel between doctor and patient
        try {
            chatService.createConversation(appointment.getId());
        } catch (Exception e) {
            log.warn("Failed to initialize conversation for appointment {}: {}", appointment.getId(), e.getMessage());
        }

        // Publish confirmation events
        publishNotification(
                appointment.getPatient().getId(),
                "Payment Successful",
                String.format("Your payment of ₹%s for Dr. %s was verified. Appointment is confirmed.",
                        payment.getAmount(),
                        appointment.getDoctor().getUser().getFullName()),
                NotificationType.PAYMENT_SUCCESS,
                payment.getId().toString()
        );

        publishNotification(
                appointment.getDoctor().getUserId(),
                "Appointment Confirmed (Paid)",
                String.format("Patient %s has completed payment. The appointment for %s is confirmed.",
                        appointment.getPatient().getFullName(),
                        appointment.getAppointmentDate()),
                NotificationType.APPOINTMENT_CONFIRMED,
                appointment.getId().toString()
        );

        return mapToResponse(payment);
    }

    /**
     * Triggers a refund for a previously completed payment through Razorpay API.
     */
    @Transactional
    public PaymentResponse initiateRefund(UUID paymentId) {
        Payment payment = paymentRepository.findByIdWithDetails(paymentId)
                .orElseThrow(() -> new RuntimeException("Payment not found"));

        if (payment.getPaymentStatus() != PaymentStatus.PAID) {
            throw new RuntimeException("Only paid consultations can be refunded");
        }

        if (payment.getRefundStatus() == RefundStatus.PROCESSED) {
            throw new RuntimeException("Refund already processed");
        }

        payment.setRefundStatus(RefundStatus.PENDING);
        payment.setPaymentStatus(PaymentStatus.REFUND_INITIATED);

        if (razorpayService.isLiveMode() && payment.getPaymentId() != null) {
            try {
                Refund refund = razorpayService.initiateRefund(payment.getPaymentId(), payment.getAmount());
                payment.setRefundStatus(RefundStatus.PROCESSED);
                payment.setPaymentStatus(PaymentStatus.REFUNDED);
                payment.setMethod(payment.getMethod() + " | refund:" + refund.get("id"));
            } catch (Exception e) {
                payment.setRefundStatus(RefundStatus.FAILED);
                paymentRepository.save(payment);
                log.error("Refund processing failed for payment {}: {}", paymentId, e.getMessage());
                throw new RuntimeException("Refund failed: " + e.getMessage(), e);
            }
        } else {
            payment.setRefundStatus(RefundStatus.PROCESSED);
            payment.setPaymentStatus(PaymentStatus.REFUNDED);
        }

        Appointment appointment = payment.getAppointment();
        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointmentRepository.save(appointment);

        paymentRepository.save(payment);
        return mapToResponse(payment);
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> getPaymentHistory(UUID patientId) {
        return paymentRepository.findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentByAppointment(UUID appointmentId) {
        return paymentRepository.findByAppointmentId(appointmentId)
                .map(this::mapToResponse)
                .orElseThrow(() -> new RuntimeException("Payment not found for appointment"));
    }

    @Transactional(readOnly = true)
    public InvoiceResponse getInvoice(UUID paymentId) {
        Payment payment = paymentRepository.findByIdWithDetails(paymentId)
                .orElseThrow(() -> new RuntimeException("Payment not found"));

        if (payment.getPaymentStatus() != PaymentStatus.PAID) {
            throw new RuntimeException("Invoice available only for completed payments");
        }

        Appointment appointment = payment.getAppointment();
        InvoiceResponse invoice = new InvoiceResponse();
        invoice.setInvoiceNumber(payment.getInvoiceNumber());
        invoice.setInvoiceDate(payment.getCreatedAt());
        invoice.setPaymentId(payment.getId());
        invoice.setAppointmentId(appointment.getId());
        invoice.setPatientName(appointment.getPatient().getFullName());
        invoice.setPatientEmail(appointment.getPatient().getEmail());
        invoice.setDoctorName(appointment.getDoctor().getUser().getFullName());
        invoice.setSpecialization(appointment.getDoctor().getSpecialization());
        invoice.setAppointmentDate(appointment.getAppointmentDate().toString());
        invoice.setTimeSlot(appointment.getTimeSlot());
        invoice.setAmount(payment.getAmount());
        invoice.setPaymentStatus(payment.getPaymentStatus().name());
        invoice.setPaymentIdExternal(payment.getPaymentId());
        invoice.setMethod(payment.getMethod());
        return invoice;
    }

    private String generateInvoiceNumber() {
        String datePart = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uniquePart = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "INV-" + datePart + "-" + uniquePart;
    }

    private void publishNotification(UUID recipientId, String title, String message,
                                     NotificationType type, String relatedEntityId) {
        try {
            eventPublisher.publishEvent(new NotificationEvent(
                    this, recipientId, title, message, type, relatedEntityId
            ));
        } catch (Exception e) {
            log.warn("Failed to publish payment notification event: {}", e.getMessage());
        }
    }

    private PaymentResponse mapToResponse(Payment payment) {
        Appointment appointment = payment.getAppointment();
        PaymentResponse response = new PaymentResponse();
        response.setId(payment.getId());
        response.setAppointmentId(appointment.getId());
        response.setDoctorName(appointment.getDoctor().getUser().getFullName());
        response.setPatientName(appointment.getPatient().getFullName());
        response.setAppointmentDate(appointment.getAppointmentDate().toString());
        response.setTimeSlot(appointment.getTimeSlot());
        response.setAppointmentStatus(appointment.getStatus().name());
        response.setAmount(payment.getAmount());
        response.setPaymentStatus(payment.getPaymentStatus().name());
        response.setPaymentId(payment.getPaymentId());
        response.setRazorpayOrderId(payment.getRazorpayOrderId());
        response.setMethod(payment.getMethod());
        response.setRefundStatus(payment.getRefundStatus().name());
        response.setInvoiceNumber(payment.getInvoiceNumber());
        response.setCreatedAt(payment.getCreatedAt());
        return response;
    }
}
