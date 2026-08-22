package com.app.chat.repository;

import com.app.chat.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, UUID> {
    Optional<Conversation> findByAppointmentId(UUID appointmentId);
    List<Conversation> findByPatientId(UUID patientId);
    List<Conversation> findByDoctorId(UUID doctorId);

    @Query("SELECT c FROM Conversation c WHERE c.patient.id = :userId OR c.doctor.user.id = :userId ORDER BY c.createdAt DESC")
    List<Conversation> findByUserId(@Param("userId") UUID userId);
}
