package com.smarttcm.service;

import com.smarttcm.entity.EmailVerification;
import com.smarttcm.entity.EmailVerification.VerificationStatus;
import com.smarttcm.entity.EmailVerification.VerificationType;
import com.smarttcm.entity.PasswordResetToken;
import com.smarttcm.exception.CustomException;
import com.smarttcm.repository.EmailVerificationRepository;
import com.smarttcm.repository.PasswordResetTokenRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class EmailService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final JavaMailSender mailSender;
    private final EmailVerificationRepository emailVerificationRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;

    @Value("${app.mail.from}")
    private String fromAddress;

    @Value("${app.mail.from-name}")
    private String fromName;

    @Value("${app.mail.verification.code-length}")
    private int codeLength;

    @Value("${app.mail.verification.expiration-minutes}")
    private int verificationExpirationMinutes;

    @Value("${app.mail.verification.max-send-per-hour}")
    private int maxSendPerHour;

    @Value("${app.mail.reset-password.token-expiration-minutes}")
    private int resetTokenExpirationMinutes;

    public EmailService(JavaMailSender mailSender,
                        EmailVerificationRepository emailVerificationRepository,
                        PasswordResetTokenRepository passwordResetTokenRepository) {
        this.mailSender = mailSender;
        this.emailVerificationRepository = emailVerificationRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
    }

    /**
     * 发送注册验证码
     */
    @Transactional
    public void sendRegistrationVerificationCode(String email) {
        checkSendRateLimit(email);
        String code = generateCode();

        emailVerificationRepository.deletePendingByEmailAndType(email, VerificationType.REGISTRATION);

        EmailVerification verification = EmailVerification.builder()
                .email(email)
                .code(code)
                .type(VerificationType.REGISTRATION)
                .status(VerificationStatus.PENDING)
                .expiresAt(LocalDateTime.now().plusMinutes(verificationExpirationMinutes))
                .build();
        emailVerificationRepository.save(verification);

        sendHtmlEmail(email, "【千方慧鉴】注册验证码",
                buildRegistrationEmailContent(email, code));
    }

    /**
     * 验证注册邮箱
     */
    @Transactional
    public void verifyRegistrationCode(String email, String code) {
        EmailVerification verification = emailVerificationRepository
                .findByEmailAndCodeAndType(email, code, VerificationType.REGISTRATION)
                .orElseThrow(() -> new CustomException("验证码无效"));

        if (verification.isExpired()) {
            verification.setStatus(VerificationStatus.EXPIRED);
            emailVerificationRepository.save(verification);
            throw new CustomException("验证码已过期");
        }

        if (verification.getStatus() == VerificationStatus.VERIFIED) {
            throw new CustomException("验证码已被使用");
        }

        verification.setStatus(VerificationStatus.VERIFIED);
        verification.setVerifiedAt(LocalDateTime.now());
        emailVerificationRepository.save(verification);
    }

    /**
     * 发送密码重置验证码
     */
    @Transactional
    public void sendPasswordResetCode(String email) {
        checkSendRateLimit(email);

        Optional<PasswordResetToken> existing = passwordResetTokenRepository
                .findTopByEmailAndUsedFalseOrderByCreatedAtDesc(email);
        if (existing.isPresent()) {
            PasswordResetToken token = existing.get();
            if (!token.isExpired()) {
                throw new CustomException("密码重置邮件已发送，请稍后再试或检查邮箱");
            }
        }

        // 生成6位数字验证码
        String resetCode = generateCode();

        PasswordResetToken newToken = PasswordResetToken.builder()
                .email(email)
                .token(resetCode)
                .expiresAt(LocalDateTime.now().plusMinutes(resetTokenExpirationMinutes))
                .used(false)
                .build();
        passwordResetTokenRepository.save(newToken);

        sendHtmlEmail(email, "【千方慧鉴】密码重置验证码",
                buildPasswordResetEmailContent(email, resetCode));
    }

    /**
     * 验证密码重置令牌是否有效
     * 验证通过后将令牌标记为已使用，并返回关联的邮箱
     */
    @Transactional
    public String validatePasswordResetToken(String email, String token) {
        PasswordResetToken resetToken = passwordResetTokenRepository
                .findByToken(token)
                .orElseThrow(() -> new CustomException("重置令牌无效"));

        if (!resetToken.getEmail().equalsIgnoreCase(email)) {
            throw new CustomException("重置令牌与邮箱不匹配");
        }

        if (resetToken.isExpired()) {
            throw new CustomException("重置链接已过期");
        }

        if (resetToken.getUsed()) {
            throw new CustomException("重置链接已被使用");
        }

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);
        return resetToken.getEmail();
    }

    private void checkSendRateLimit(String email) {
        LocalDateTime oneHourAgo = LocalDateTime.now().minusHours(1);
        long count = emailVerificationRepository.countByEmailSince(email, oneHourAgo);
        if (count >= maxSendPerHour) {
            throw new CustomException("发送次数过多，请1小时后再试");
        }
    }

    private String generateCode() {
        StringBuilder code = new StringBuilder(codeLength);
        for (int i = 0; i < codeLength; i++) {
            code.append(SECURE_RANDOM.nextInt(10));
        }
        return code.toString();
    }

    @Async
    protected void sendHtmlEmail(String to, String subject, String htmlContent) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(String.format("%s <%s>", fromName, fromAddress));
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);
            mailSender.send(message);
        } catch (MessagingException e) {
            throw new CustomException("邮件发送失败，请稍后重试");
        }
    }

    private String buildRegistrationEmailContent(String email, String code) {
        return """
                <div style="max-width: 500px; margin: 0 auto; font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif; background-color: #F8FAF8;">
                  <!-- 顶部装饰条 -->
                  <div style="height: 4px; background: linear-gradient(90deg, #5B7D63, #7C9A82, #5B7D63);"></div>
                  <!-- 头部 -->
                  <div style="background: linear-gradient(135deg, #3A5A40, #5B7D63, #7C9A82); padding: 36px 24px; text-align: center;">
                    <h1 style="color: #FFFFFF; font-size: 26px; margin: 0; font-weight: 700; letter-spacing: 4px;">🌿 千方慧鉴</h1>
                    <p style="color: #D4E8D0; font-size: 14px; margin: 10px 0 0; letter-spacing: 2px;">融汇经典 · 慧鉴健康</p>
                  </div>
                  <!-- 内容区 -->
                  <div style="background-color: #FFFFFF; padding: 36px 28px; border-left: 1px solid #E2E8E3; border-right: 1px solid #E2E8E3;">
                    <p style="color: #2D3B2E; font-size: 15px; margin: 0 0 24px; line-height: 1.8;">
                      尊敬的用户，您好！
                    </p>
                    <p style="color: #6B7B6E; font-size: 14px; margin: 0 0 28px; line-height: 1.8;">
                      欢迎注册 <strong style="color: #5B7D63;">千方慧鉴</strong> 平台。请使用以下验证码完成注册：
                    </p>
                    <!-- 验证码区域 -->
                    <div style="background: linear-gradient(135deg, #F0F7F1, #E8F5E9); border: 2px solid #7C9A82; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
                      <p style="color: #6B7B6E; font-size: 12px; margin: 0 0 10px; letter-spacing: 1px;">注 册 验 证 码</p>
                      <p style="color: #5B7D63; font-size: 36px; font-weight: 800; margin: 0; letter-spacing: 10px; font-family: 'Courier New', monospace;">%s</p>
                      <p style="color: #8B9E8F; font-size: 12px; margin: 12px 0 0;">验证码 5 分钟内有效，请尽快使用</p>
                    </div>
                    <div style="border-left: 3px solid #7C9A82; padding: 12px 16px; background: #F0F7F1; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
                      <p style="color: #6B7B6E; font-size: 13px; margin: 0; line-height: 1.8;">
                        🔒 为保障账户安全，请勿将验证码告知他人。如非本人操作，请忽略此邮件。
                      </p>
                    </div>
                  </div>
                  <!-- 底部 -->
                  <div style="text-align: center; padding: 24px; color: #8B9E8F; font-size: 12px; background-color: #F8FAF8; border-top: 1px solid #E2E8E3;">
                    <p style="margin: 0;">此邮件由 <strong style="color: #5B7D63;">千方慧鉴</strong> 系统自动发送，请勿回复</p>
                    <p style="margin: 6px 0 0;">&copy; 2026 千方慧鉴 · All Rights Reserved</p>
                  </div>
                  <!-- 底部装饰条 -->
                  <div style="height: 4px; background: linear-gradient(90deg, #5B7D63, #7C9A82, #5B7D63);"></div>
                </div>
                """.formatted(code);
    }

    private String buildPasswordResetEmailContent(String email, String token) {
        return """
                <div style="max-width: 500px; margin: 0 auto; font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif; background-color: #F8FAF8;">
                  <!-- 顶部装饰条 -->
                  <div style="height: 4px; background: linear-gradient(90deg, #5B7D63, #7C9A82, #5B7D63);"></div>
                  <!-- 头部 -->
                  <div style="background: linear-gradient(135deg, #3A5A40, #5B7D63, #7C9A82); padding: 36px 24px; text-align: center;">
                    <h1 style="color: #FFFFFF; font-size: 26px; margin: 0; font-weight: 700; letter-spacing: 4px;">🌿 千方慧鉴</h1>
                    <p style="color: #D4E8D0; font-size: 14px; margin: 10px 0 0; letter-spacing: 2px;">密码重置验证</p>
                  </div>
                  <!-- 内容区 -->
                  <div style="background-color: #FFFFFF; padding: 36px 28px; border-left: 1px solid #E2E8E3; border-right: 1px solid #E2E8E3;">
                    <p style="color: #2D3B2E; font-size: 15px; margin: 0 0 24px; line-height: 1.8;">
                      尊敬的用户，您好！
                    </p>
                    <p style="color: #6B7B6E; font-size: 14px; margin: 0 0 28px; line-height: 1.8;">
                      我们收到了您在 <strong style="color: #5B7D63;">千方慧鉴</strong> 平台的密码重置请求。请使用以下验证码重置您的密码：
                    </p>
                    <!-- 验证码区域 -->
                    <div style="background: linear-gradient(135deg, #F0F7F1, #E8F5E9); border: 2px solid #7C9A82; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
                      <p style="color: #6B7B6E; font-size: 12px; margin: 0 0 10px; letter-spacing: 1px;">密 码 重 置 验 证 码</p>
                      <p style="color: #5B7D63; font-size: 36px; font-weight: 800; margin: 0; letter-spacing: 10px; font-family: 'Courier New', monospace;">%s</p>
                      <p style="color: #8B9E8F; font-size: 12px; margin: 12px 0 0;">验证码 30 分钟内有效</p>
                    </div>
                    <div style="border-left: 3px solid #C0392B; padding: 12px 16px; background: #FEF7F7; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
                      <p style="color: #6B7B6E; font-size: 13px; margin: 0; line-height: 1.8;">
                        ⚠️ 如果您未发起此密码重置请求，请立即检查账户安全并忽略此邮件。请勿将验证码告知他人。
                      </p>
                    </div>
                  </div>
                  <!-- 底部 -->
                  <div style="text-align: center; padding: 24px; color: #8B9E8F; font-size: 12px; background-color: #F8FAF8; border-top: 1px solid #E2E8E3;">
                    <p style="margin: 0;">此邮件由 <strong style="color: #5B7D63;">千方慧鉴</strong> 系统自动发送，请勿回复</p>
                    <p style="margin: 6px 0 0;">&copy; 2026 千方慧鉴 · All Rights Reserved</p>
                  </div>
                  <!-- 底部装饰条 -->
                  <div style="height: 4px; background: linear-gradient(90deg, #5B7D63, #7C9A82, #5B7D63);"></div>
                </div>
                """.formatted(token);
    }
}
