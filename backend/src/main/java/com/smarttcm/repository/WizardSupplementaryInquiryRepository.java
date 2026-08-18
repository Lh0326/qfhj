package com.smarttcm.repository;

import com.smarttcm.entity.WizardSupplementaryInquiry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * WizardSupplementaryInquiry Repository - 补充问诊数据访问层
 */
@Repository
public interface WizardSupplementaryInquiryRepository extends JpaRepository<WizardSupplementaryInquiry, Long> {

    Optional<WizardSupplementaryInquiry> findBySessionId(Long sessionId);

    @Modifying
    @Query("DELETE FROM WizardSupplementaryInquiry w WHERE w.sessionId = :sessionId")
    void deleteBySessionId(@Param("sessionId") Long sessionId);
}
