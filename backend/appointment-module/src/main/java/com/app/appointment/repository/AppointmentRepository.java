package com.app.appointment.repository;

import com.app.appointment.entity.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {
    List<Appointment> findByPatientIdOrderByAppointmentDateDesc(UUID patientId);
    List<Appointment> findByDoctorIdOrderByAppointmentDateDesc(UUID doctorId);

    /**
     * Eagerly fetches appointment with patient and doctor (and doctor's user) in one query.
     * This avoids LazyInitializationException in contexts without an active Hibernate session,
     * such as WebSocket STOMP message handlers.
     */
    @Query("SELECT a FROM Appointment a " +
           "JOIN FETCH a.patient " +
           "JOIN FETCH a.doctor d " +
           "JOIN FETCH d.user " +
           "WHERE a.id = :id")
    Optional<Appointment> findByIdWithParties(@Param("id") UUID id);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.patient.id = :patientId AND a.createdAt >= :startOfDay AND a.createdAt <= :endOfDay")
    long countAppointmentsForPatientToday(
            @Param("patientId") UUID patientId,
            @Param("startOfDay") java.time.LocalDateTime startOfDay,
            @Param("endOfDay") java.time.LocalDateTime endOfDay);
}

