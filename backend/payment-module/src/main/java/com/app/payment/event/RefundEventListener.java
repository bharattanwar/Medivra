package com.app.payment.event;

import com.app.common.event.RefundEvent;
import com.app.common.event.RescheduleEvent;
import com.app.appointment.entity.Appointment;
import com.app.appointment.repository.AppointmentRepository;
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
 * Also listens for RescheduleEvent to transfer payments.
 */
@Component
public class RefundEventListener {

    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;
    private final AppointmentRepository appointmentRepository;

    public RefundEventListener(PaymentRepository paymentRepository, PaymentService paymentService, AppointmentRepository appointmentRepository) {
        this.paymentRepository = paymentRepository;
        this.paymentService = paymentService;
        this.appointmentRepository = appointmentRepository;
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

    @EventListener
    public void handleRescheduleEvent(RescheduleEvent event) {
        try {
            if (event.isAccepted()) {
                Optional<Payment> paymentOpt = paymentRepository.findByAppointmentId(event.getOldAppointmentId());
                if (paymentOpt.isPresent()) {
                    Payment payment = paymentOpt.get();
                    Optional<Appointment> newAppOpt = appointmentRepository.findById(event.getNewAppointmentId());
                    if (newAppOpt.isPresent()) {
                        payment.setAppointment(newAppOpt.get());
                        paymentRepository.save(payment);
                        System.out.println("Payment transferred from appointment " + event.getOldAppointmentId() + " to " + event.getNewAppointmentId());
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to transfer payment for rescheduled appointment: " + e.getMessage());
        }
    }
}
