package com.app.ai.repository;

import com.app.ai.entity.AiInteraction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface AiInteractionRepository extends JpaRepository<AiInteraction, UUID> {
}
