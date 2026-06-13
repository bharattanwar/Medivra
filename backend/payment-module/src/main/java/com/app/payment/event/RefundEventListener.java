package com.app.payment.event;

import com.app.common.event.RefundEvent;
import com.app.payment.entity.Payment;
import com.app.payment.entity.PaymentStatus;
import com.app.payment.repository.PaymentRepository;
import com.app.payment.service.PaymentService;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Listens for RefundEvent published by appointment-module when a paid
 * appointment is cancelled or rejected, and initiates the refund flow.
 */
@Component
public class RefundEventListener {

    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;

    public RefundEventListener(PaymentRepository paymentRepository, PaymentService paymentService) {
        this.paymentRepository = paymentRepository;
        this.paymentService = paymentService;
    }

    @EventListener
    public void handleRefundEvent(RefundEvent event) {
        try {
            Optional<Payment> paymentOpt = paymentRepository.findByAppointmentId(event.getAppointmentId());
            if (paymentOpt.isPresent()) {
                Payment payment = paymentOpt.get();
                if (payment.getPaymentStatus() == PaymentStatus.PAID) {
                    paymentService.initiateRefund(payment.getId());
                    System.out.println("Refund initiated for appointment: " + event.getAppointmentId());
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to process refund for appointment " + event.getAppointmentId() + ": " + e.getMessage());
        }
    }
}
