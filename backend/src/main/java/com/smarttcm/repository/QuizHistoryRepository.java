package com.smarttcm.repository;

import com.smarttcm.entity.QuizHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * QuizHistory Repository - 答题历史数据访问层
 */
@Repository
public interface QuizHistoryRepository extends JpaRepository<QuizHistory, Long> {

    /**
     * 按用户ID查询，按更新时间倒序
     */
    Page<QuizHistory> findByUserIdOrderByUpdatedAtDesc(Long userId, Pageable pageable);

    /**
     * 按用户ID查询最近记录
     */
    List<QuizHistory> findTop10ByUserIdOrderByUpdatedAtDesc(Long userId);

    /**
     * 统计用户总答题数
     */
    @Query("SELECT COALESCE(SUM(qh.totalQuestions), 0) FROM QuizHistory qh WHERE qh.userId = :userId")
    long countTotalQuestionsByUserId(@Param("userId") Long userId);

    /**
     * 统计用户正确答题数
     */
    @Query("SELECT COALESCE(SUM(qh.correctCount), 0) FROM QuizHistory qh WHERE qh.userId = :userId")
    long countCorrectAnswersByUserId(@Param("userId") Long userId);

    /**
     * 统计用户总学习时长（秒）
     */
    @Query("SELECT COALESCE(SUM(qh.totalTimeSeconds), 0) FROM QuizHistory qh WHERE qh.userId = :userId")
    long sumTotalTimeByUserId(@Param("userId") Long userId);

    /**
     * 统计用户答题次数
     */
    long countByUserId(Long userId);

    /**
     * 按日期范围查询用户答题记录
     */
    @Query("SELECT qh FROM QuizHistory qh WHERE qh.userId = :userId AND qh.createdAt >= :startDate AND qh.createdAt <= :endDate ORDER BY qh.createdAt DESC")
    List<QuizHistory> findByUserIdAndDateRange(@Param("userId") Long userId,
                                                @Param("startDate") LocalDateTime startDate,
                                                @Param("endDate") LocalDateTime endDate);

    /**
     * 获取用户最近N天的答题记录
     */
    @Query("SELECT qh FROM QuizHistory qh WHERE qh.userId = :userId AND qh.createdAt >= :since ORDER BY qh.createdAt DESC")
    List<QuizHistory> findRecentByUserId(@Param("userId") Long userId, @Param("since") LocalDateTime since);
}
