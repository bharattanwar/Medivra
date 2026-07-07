package com.app.emergency.repository;

import com.app.emergency.entity.AmbulanceDriver;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AmbulanceDriverRepository extends JpaRepository<AmbulanceDriver, UUID> {

    Optional<AmbulanceDriver> findByUserId(UUID userId);

    boolean existsByUserId(UUID userId);
}
