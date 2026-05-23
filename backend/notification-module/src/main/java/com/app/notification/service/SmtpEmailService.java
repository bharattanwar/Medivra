package com.app.notification.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class SmtpEmailService implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String senderEmail;

    public SmtpEmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Override
    public void sendEmail(String to, String subject, String content) {
        if (senderEmail == null || senderEmail.isBlank()) {
            System.err.println("[Email] SPRING_MAIL_USERNAME is not set — skipping email to: " + to);
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setSubject(subject);
            message.setText(content);
            // Gmail SMTP requires From == the authenticated account; any other address is rejected
            message.setFrom(senderEmail);
            mailSender.send(message);
            System.out.println("[Email] Sent to: " + to + " | Subject: " + subject);
        } catch (Exception e) {
            System.err.println("[Email] Failed to send to " + to + ": " + e.getMessage());
        }
    }
}
