package com.smarttcm.repository;

import com.smarttcm.entity.WizardSymptomAssessment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * WizardSymptomAssessment Repository - 症状评估数据访问层
 */
@Repository
public interface WizardSymptomAssessmentRepository extends JpaRepository<WizardSymptomAssessment, Long> {

    /**
     * 按会话ID查询所有评估
     */
    List<WizardSymptomAssessment> findBySessionId(Long sessionId);

    /**
     * 按会话ID删除所有评估
     */
    void deleteBySessionId(Long sessionId);

    /**
     * 按会话ID统计评估数量
     */
    long countBySessionId(Long sessionId);
}
