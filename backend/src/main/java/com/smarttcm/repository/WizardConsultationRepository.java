package com.smarttcm.repository;

import com.smarttcm.entity.WizardConsultation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * WizardConsultation Repository - 多流派会诊数据访问层
 */
@Repository
public interface WizardConsultationRepository extends JpaRepository<WizardConsultation, Long> {

    /**
     * 按会话ID查询会诊
     */
    Optional<WizardConsultation> findBySessionId(Long sessionId);

    /**
     * 按会话ID删除
     */
    void deleteBySessionId(Long sessionId);
}
