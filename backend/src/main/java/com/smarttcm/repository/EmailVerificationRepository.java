package com.smarttcm.repository;

import com.smarttcm.entity.EmailVerification;
import com.smarttcm.entity.EmailVerification.VerificationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Email Verification Repository - 邮箱验证码数据访问层
 */
@Repository
public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Long> {

    /**
     * 根据邮箱和类型查找最新的验证码记录
     */
    Optional<EmailVerification> findTopByEmailAndTypeOrderByCreatedAtDesc(
            String email, VerificationType type);

    /**
     * 根据邮箱和验证码查找记录
     */
    Optional<EmailVerification> findByEmailAndCodeAndType(
            String email, String code, VerificationType type);

    /**
     * 删除指定邮箱的所有未验证记录
     */
    @Modifying
    @Query("DELETE FROM EmailVerification ev WHERE ev.email = :email AND ev.type = :type AND ev.status = 'PENDING'")
    void deletePendingByEmailAndType(
            @Param("email") String email,
            @Param("type") VerificationType type);

    /**
     * 统计指定邮箱在给定时间后的发送次数
     */
    @Query("SELECT COUNT(ev) FROM EmailVerification ev WHERE ev.email = :email AND ev.createdAt > :since")
    long countByEmailSince(
            @Param("email") String email,
            @Param("since") LocalDateTime since);

    /**
     * 将所有过期的待验证记录标记为已过期
     */
    @Modifying
    @Query("UPDATE EmailVerification ev SET ev.status = 'EXPIRED' WHERE ev.status = 'PENDING' AND ev.expiresAt < :now")
    int expireOldVerifications(@Param("now") LocalDateTime now);
}
