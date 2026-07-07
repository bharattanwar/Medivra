package com.app.emergency.repository;

import com.app.emergency.entity.EmergencyContact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EmergencyContactRepository extends JpaRepository<EmergencyContact, UUID> {

    List<EmergencyContact> findByPatientId(UUID patientId);

    void deleteByIdAndPatientId(UUID id, UUID patientId);
}
