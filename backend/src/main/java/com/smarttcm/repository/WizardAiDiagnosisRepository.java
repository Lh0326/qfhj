package com.smarttcm.repository;

import com.smarttcm.entity.WizardAiDiagnosis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * WizardAiDiagnosis Repository - AI诊断结果数据访问层
 */
@Repository
public interface WizardAiDiagnosisRepository extends JpaRepository<WizardAiDiagnosis, Long> {

    /**
     * 按会话ID查询诊断结果
     */
    Optional<WizardAiDiagnosis> findBySessionId(Long sessionId);

    /**
     * 按会话ID删除诊断结果
     */
    void deleteBySessionId(Long sessionId);
}
