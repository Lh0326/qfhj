package com.smarttcm.repository;

import com.smarttcm.entity.WizardOperationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * WizardOperationLog Repository - 问诊操作日志数据访问层
 */
@Repository
public interface WizardOperationLogRepository extends JpaRepository<WizardOperationLog, Long> {

    /**
     * 按会话ID查询日志，按创建时间排序
     */
    List<WizardOperationLog> findBySessionIdOrderByCreatedAtAsc(Long sessionId);

    /**
     * 按会话ID和步骤查询日志
     */
    List<WizardOperationLog> findBySessionIdAndStepNoOrderByCreatedAtAsc(Long sessionId, Integer stepNo);

    void deleteBySessionId(Long sessionId);
}
