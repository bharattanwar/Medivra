package com.app.payment.repository;

import com.app.payment.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    @Query("SELECT p FROM Payment p JOIN FETCH p.appointment a JOIN FETCH a.doctor d JOIN FETCH d.user JOIN FETCH a.patient WHERE a.id = :appointmentId")
    Optional<Payment> findByAppointmentId(UUID appointmentId);

    @Query("SELECT p FROM Payment p JOIN FETCH p.appointment a JOIN FETCH a.doctor d JOIN FETCH d.user JOIN FETCH a.patient WHERE a.patient.id = :patientId ORDER BY p.createdAt DESC")
    List<Payment> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    @Query("SELECT p FROM Payment p JOIN FETCH p.appointment a JOIN FETCH a.doctor d JOIN FETCH d.user JOIN FETCH a.patient WHERE p.id = :id")
    Optional<Payment> findByIdWithDetails(UUID id);

    Optional<Payment> findByRazorpayOrderId(String razorpayOrderId);
}
