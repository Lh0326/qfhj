package com.smarttcm.repository;

import com.smarttcm.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Password Reset Token Repository - 密码重置令牌数据访问层
 */
@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /**
     * 根据令牌查找记录
     */
    Optional<PasswordResetToken> findByToken(String token);

    /**
     * 根据邮箱查找最新的有效令牌
     */
    Optional<PasswordResetToken> findTopByEmailAndUsedFalseOrderByCreatedAtDesc(String email);

    /**
     * 使指定邮箱的所有令牌失效
     */
    @Modifying
    @Query("UPDATE PasswordResetToken t SET t.used = true WHERE t.email = :email AND t.used = false")
    int invalidateAllByEmail(@Param("email") String email);

    /**
     * 删除指定邮箱的所有过期令牌
     */
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.email = :email AND t.expiresAt < :now")
    int deleteExpiredByEmail(@Param("email") String email, @Param("now") LocalDateTime now);
}
