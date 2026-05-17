package com.app.chat.repository;

import com.app.chat.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MessageRepository extends JpaRepository<Message, UUID> {
    List<Message> findByConversationIdOrderByCreatedAtAsc(UUID conversationId);
    long countByConversationIdAndIsReadFalseAndSenderIdNot(UUID conversationId, UUID userId);
}
