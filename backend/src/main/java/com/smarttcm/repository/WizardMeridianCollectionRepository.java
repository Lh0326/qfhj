package com.smarttcm.repository;

import com.smarttcm.entity.WizardMeridianCollection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * WizardMeridianCollection Repository - 子午归经采集数据访问层
 */
@Repository
public interface WizardMeridianCollectionRepository extends JpaRepository<WizardMeridianCollection, Long> {

    /**
     * 按会话ID查询
     */
    List<WizardMeridianCollection> findBySessionId(Long sessionId);

    /**
     * 按会话ID删除
     */
    void deleteBySessionId(Long sessionId);
}
