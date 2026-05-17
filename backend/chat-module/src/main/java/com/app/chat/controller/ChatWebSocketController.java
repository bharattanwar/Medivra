package com.app.chat.controller;

import com.app.chat.dto.MessageResponse;
import com.app.chat.dto.SendMessageRequest;
import com.app.chat.service.ChatService;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;

import java.util.Optional;

@Controller
public class ChatWebSocketController {

    private final ChatService chatService;
    private final UserRepository userRepository;

    public ChatWebSocketController(ChatService chatService, UserRepository userRepository) {
        this.chatService = chatService;
        this.userRepository = userRepository;
    }

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload SendMessageRequest request, Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            Optional<User> userOpt = userRepository.findByEmail(userDetails.getUsername());
            
            userOpt.ifPresent(user -> {
                chatService.sendMessage(request, user.getId());
            });
        }
    }
}
