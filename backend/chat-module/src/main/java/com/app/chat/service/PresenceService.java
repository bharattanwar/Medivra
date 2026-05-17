package com.app.chat.service;

import com.app.chat.dto.PresenceUpdate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PresenceService {

    private final SimpMessagingTemplate messagingTemplate;
    private final ConcurrentHashMap<UUID, Boolean> onlineUsers = new ConcurrentHashMap<>();

    public PresenceService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void handleUserConnect(UUID userId) {
        onlineUsers.put(userId, true);
        broadcastPresence(userId, "ONLINE");
    }

    public void handleUserDisconnect(UUID userId) {
        onlineUsers.remove(userId);
        broadcastPresence(userId, "OFFLINE");
    }

    public boolean isUserOnline(UUID userId) {
        return onlineUsers.getOrDefault(userId, false);
    }

    private void broadcastPresence(UUID userId, String status) {
        PresenceUpdate update = new PresenceUpdate(userId, status);
        // We broadcast to a public topic so anyone who needs to know can subscribe
        messagingTemplate.convertAndSend("/topic/presence", update);
    }
}
