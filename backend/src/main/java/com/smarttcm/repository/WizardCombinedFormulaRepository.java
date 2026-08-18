package com.smarttcm.repository;

import com.smarttcm.entity.WizardCombinedFormula;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * WizardCombinedFormula Repository - 合病合方数据访问层
 */
@Repository
public interface WizardCombinedFormulaRepository extends JpaRepository<WizardCombinedFormula, Long> {

    /**
     * 按会话ID查询合病合方
     */
    Optional<WizardCombinedFormula> findBySessionId(Long sessionId);

    /**
     * 按会话ID删除
     */
    void deleteBySessionId(Long sessionId);
}
