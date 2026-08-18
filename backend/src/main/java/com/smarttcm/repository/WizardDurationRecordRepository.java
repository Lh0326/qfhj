package com.smarttcm.repository;

import com.smarttcm.entity.WizardDurationRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * WizardDurationRecord Repository - 六经传变持续时日数据访问层
 */
@Repository
public interface WizardDurationRecordRepository extends JpaRepository<WizardDurationRecord, Long> {

    /**
     * 按会话ID查询
     */
    List<WizardDurationRecord> findBySessionId(Long sessionId);

    /**
     * 按会话ID删除
     */
    void deleteBySessionId(Long sessionId);
}
