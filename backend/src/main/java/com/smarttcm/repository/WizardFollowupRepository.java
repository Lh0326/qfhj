package com.smarttcm.repository;

import com.smarttcm.entity.WizardFollowup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * WizardFollowup Repository - 疗效评估随访数据访问层
 */
@Repository
public interface WizardFollowupRepository extends JpaRepository<WizardFollowup, Long> {

    /**
     * 按会话ID查询随访
     */
    Optional<WizardFollowup> findBySessionId(Long sessionId);

    /**
     * 按会话ID删除
     */
    void deleteBySessionId(Long sessionId);
}
