package com.app.chat.config;

import com.app.chat.service.PresenceService;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Optional;

@Component
public class WebSocketEventListener {

    private final PresenceService presenceService;
    private final UserRepository userRepository;

    public WebSocketEventListener(PresenceService presenceService,UserRepository userRepository) {
        this.presenceService = presenceService;
        this.userRepository = userRepository;
    }

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        if (headerAccessor.getUser()
            instanceof UsernamePasswordAuthenticationToken authentication) {
            if (authentication.getPrincipal()
                instanceof UserDetails userDetails) {
                Optional<User> userOpt =userRepository.findByEmail(userDetails.getUsername());
                userOpt.ifPresent(user -> {
                System.out.println("User connected: " + user.getEmail());
                presenceService.handleUserConnect(user.getId());
                });
            }
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        System.out.println("User disconnected");
    }
}