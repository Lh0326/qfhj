package com.smarttcm.repository;

import com.smarttcm.entity.WizardDiagnosisSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * WizardDiagnosisSession Repository - 向导式问诊会话数据访问层
 */
@Repository
public interface WizardDiagnosisSessionRepository extends JpaRepository<WizardDiagnosisSession, Long> {

    /**
     * 按用户ID查询，按创建时间倒序
     */
    List<WizardDiagnosisSession> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * 查询用户指定会话
     */
    Optional<WizardDiagnosisSession> findByIdAndUserId(Long id, Long userId);

    /**
     * 按状态查询用户会话
     */
    List<WizardDiagnosisSession> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);
}
