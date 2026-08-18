package com.smarttcm.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Email Verification Entity - 邮箱验证码实体
 * 用于存储注册验证码和密码重置验证码
 */
@Entity
@Table(name = "email_verifications",
        indexes = {
                @Index(name = "idx_email_type", columnList = "email, type"),
                @Index(name = "idx_email_code", columnList = "email, code")
        })
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "email", nullable = false, length = 100)
    private String email;

    @Column(name = "code", nullable = false, length = 10)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private VerificationType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private VerificationStatus status = VerificationStatus.PENDING;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    /**
     * 验证码类型
     */
    public enum VerificationType {
        REGISTRATION,    // 注册验证码
        PASSWORD_RESET   // 密码重置验证码
    }

    /**
     * 验证码状态
     */
    public enum VerificationStatus {
        PENDING,    // 待验证
        VERIFIED,   // 已验证
        EXPIRED     // 已过期
    }

    /**
     * 检查验证码是否过期
     */
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    /**
     * 检查验证码是否有效（未过期且未验证）
     */
    public boolean isValid() {
        return status == VerificationStatus.PENDING && !isExpired();
    }
}
