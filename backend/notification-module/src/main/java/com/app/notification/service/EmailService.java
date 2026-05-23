package com.app.notification.service;

public interface EmailService {
    void sendEmail(String to, String subject, String content);
}
