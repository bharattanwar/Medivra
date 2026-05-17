package com.app.chat.controller;

import com.app.chat.dto.MessageResponse;
import com.app.chat.service.ChatService;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;
import com.app.chat.service.ChatFileStorageService;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;
    private final UserRepository userRepository;
    private final ChatFileStorageService chatFileStorageService;

    public ChatController(ChatService chatService, UserRepository userRepository, ChatFileStorageService chatFileStorageService) {
        this.chatService = chatService;
        this.userRepository = userRepository;
        this.chatFileStorageService = chatFileStorageService;
    }

    @GetMapping("/appointment/{appointmentId}")
    public ResponseEntity<com.app.chat.dto.ConversationResponse> getConversationByAppointment(@PathVariable UUID appointmentId) {
        return chatService.getConversationByAppointment(appointmentId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<List<MessageResponse>> getMessages(
            @PathVariable UUID conversationId,
            Authentication authentication) {
            
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        Optional<User> userOpt = userRepository.findByEmail(userDetails.getUsername());
        
        if (userOpt.isPresent()) {
            List<MessageResponse> messages = chatService.getMessages(conversationId, userOpt.get().getId());
            return ResponseEntity.ok(messages);
        }
        
        return ResponseEntity.status(401).build();
    }

    @PostMapping("/upload")
    public ResponseEntity<String> uploadAttachment(@RequestParam("file") MultipartFile file) {
        String fileName = chatFileStorageService.storeFile(file);
        // Assuming API gateway or local serving from /api/chat/download/
        String fileDownloadUri = "/api/chat/download/" + fileName;
        return ResponseEntity.ok(fileDownloadUri);
    }

    @GetMapping("/download/{fileName:.+}")
    public ResponseEntity<Resource> downloadAttachment(@PathVariable String fileName) {
        Resource resource = chatFileStorageService.loadFileAsResource(fileName);
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }
}
