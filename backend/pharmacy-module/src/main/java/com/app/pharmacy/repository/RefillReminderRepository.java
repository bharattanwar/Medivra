package com.app.pharmacy.repository;

import com.app.pharmacy.entity.RefillReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RefillReminderRepository extends JpaRepository<RefillReminder, UUID> {
    List<RefillReminder> findByPatientIdAndIsActiveTrueOrderByNextRefillDateAsc(UUID patientId);
}
