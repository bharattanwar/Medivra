package com.app.notification.controller;

import com.app.common.dto.ApiResponse;
import com.app.notification.dto.NotificationResponse;
import com.app.notification.dto.PushTokenRequest;
import com.app.notification.service.NotificationService;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public NotificationController(NotificationService notificationService, UserRepository userRepository) {
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    private Optional<User> resolveAuthenticatedUser(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            return userRepository.findByEmail(userDetails.getUsername());
        }
        return Optional.empty();
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getNotifications(Authentication authentication) {
        Optional<User> userOpt = resolveAuthenticatedUser(authentication);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).build();
        }
        List<NotificationResponse> notifications = notificationService.getNotificationsForUser(userOpt.get().getId());
        return ResponseEntity.ok(ApiResponse.success(notifications, "Notifications retrieved successfully"));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Long>> getUnreadCount(Authentication authentication) {
        Optional<User> userOpt = resolveAuthenticatedUser(authentication);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).build();
        }
        long count = notificationService.getUnreadCount(userOpt.get().getId());
        return ResponseEntity.ok(ApiResponse.success(count, "Unread count retrieved successfully"));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(@PathVariable UUID id, Authentication authentication) {
        Optional<User> userOpt = resolveAuthenticatedUser(authentication);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).build();
        }
        notificationService.markAsRead(id, userOpt.get().getId());
        return ResponseEntity.ok(ApiResponse.success(null, "Notification marked as read"));
    }

    @PutMapping("/read-all")
    public ResponseEntity<ApiResponse<Void>> markAllAsRead(Authentication authentication) {
        Optional<User> userOpt = resolveAuthenticatedUser(authentication);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).build();
        }
        notificationService.markAllAsRead(userOpt.get().getId());
        return ResponseEntity.ok(ApiResponse.success(null, "All notifications marked as read"));
    }

    @PostMapping("/push-token")
    public ResponseEntity<ApiResponse<Void>> registerPushToken(@Valid @RequestBody PushTokenRequest request,
                                                               Authentication authentication) {
        Optional<User> userOpt = resolveAuthenticatedUser(authentication);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).build();
        }
        notificationService.registerPushToken(userOpt.get().getId(), request.getToken(), request.getDeviceType());
        return ResponseEntity.ok(ApiResponse.success(null, "Push token registered successfully"));
    }

    @DeleteMapping("/push-token")
    public ResponseEntity<ApiResponse<Void>> removePushToken(@Valid @RequestBody PushTokenRequest request,
                                                             Authentication authentication) {
        Optional<User> userOpt = resolveAuthenticatedUser(authentication);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).build();
        }
        notificationService.removePushToken(userOpt.get().getId(), request.getToken());
        return ResponseEntity.ok(ApiResponse.success(null, "Push token removed successfully"));
    }
}
