package com.app.notification.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class SmtpEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailService.class);

    private final JavaMailSender mailSender;

    @Value("${MAIL_FROM:${spring.mail.username:}}")
    private String senderEmail;

    public SmtpEmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Override
    public void sendEmail(String to, String subject, String content) {
        if (senderEmail == null || senderEmail.isBlank()) {
            log.error("[Email] MAIL_FROM is not set in environment — cannot send email to: {}", to);
            return;
        }
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

            helper.setFrom(senderEmail);
            helper.setTo(to);
            helper.setSubject(subject);

            // Build HTML body from plain text content by wrapping in preformatted style
            String htmlContent = "<html><body style=\"font-family: Arial, sans-serif; line-height: 1.6;\">"
                    + "<pre style=\"font-family: inherit; white-space: pre-wrap;\">" + content + "</pre>"
                    + "</body></html>";

            helper.setText(htmlContent, true); // HTML body

            mailSender.send(mimeMessage);
            log.info("[Email] Successfully sent to: {} | Subject: {}", to, subject);

        } catch (MessagingException e) {
            log.error("[Email] MessagingException — failed to send to {}: {}", to, e.getMessage(), e);
        } catch (Exception e) {
            log.error("[Email] Unexpected error sending to {}: {}", to, e.getMessage(), e);
        }
    }
}
