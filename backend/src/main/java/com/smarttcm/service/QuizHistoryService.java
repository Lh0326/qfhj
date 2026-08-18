package com.smarttcm.service;

import com.smarttcm.dto.QuizRecordResponse;
import com.smarttcm.entity.QuizHistory;
import com.smarttcm.repository.QuizHistoryRepository;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * QuizHistory Service - 答题历史业务逻辑层
 * 处理答题历史记录的查询和统计
 */
@Service
public class QuizHistoryService {

    private final QuizHistoryRepository quizHistoryRepository;

    public QuizHistoryService(QuizHistoryRepository quizHistoryRepository) {
        this.quizHistoryRepository = quizHistoryRepository;
    }

    /**
     * 获取用户学习统计信息
     */
    public Map<String, Object> getQuizHistoryStats(Long userId) {
        Map<String, Object> stats = new LinkedHashMap<>();

        // 总答题数
        long totalQuestions = quizHistoryRepository.countTotalQuestionsByUserId(userId);
        stats.put("totalQuestions", totalQuestions);

        // 正确数
        long correctAnswers = quizHistoryRepository.countCorrectAnswersByUserId(userId);
        stats.put("correctAnswers", correctAnswers);

        // 正确率
        double accuracy = totalQuestions > 0 ? (double) correctAnswers / totalQuestions * 100 : 0;
        stats.put("accuracy", Math.round(accuracy * 10.0) / 10.0);

        // 总学习时长（秒）
        long totalSeconds = quizHistoryRepository.sumTotalTimeByUserId(userId);
        stats.put("totalStudySeconds", totalSeconds);
        stats.put("totalStudyMinutes", totalSeconds / 60);

        // 答题次数
        long quizCount = quizHistoryRepository.countByUserId(userId);
        stats.put("quizCount", quizCount);

        // 本周学习统计
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime weekStart = now.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toLocalDate().atStartOfDay();
        List<QuizHistory> weekRecords = quizHistoryRepository.findRecentByUserId(userId, weekStart);

        long weekQuestions = weekRecords.stream().mapToLong(r -> r.getTotalQuestions() != null ? r.getTotalQuestions() : 0).sum();
        long weekCorrect = weekRecords.stream().mapToLong(r -> r.getCorrectCount() != null ? r.getCorrectCount() : 0).sum();
        long weekTime = weekRecords.stream().mapToLong(r -> r.getTotalTimeSeconds() != null ? r.getTotalTimeSeconds() : 0).sum();

        stats.put("weekQuestions", weekQuestions);
        stats.put("weekCorrect", weekCorrect);
        stats.put("weekStudyMinutes", weekTime / 60);

        // 按类别统计
        List<QuizHistory> allRecords = quizHistoryRepository.findTop10ByUserIdOrderByUpdatedAtDesc(userId);
        Map<String, Long> categoryStats = new HashMap<>();
        for (QuizHistory record : allRecords) {
            String cat = record.getQuestionCategory();
            if (cat != null) {
                categoryStats.merge(cat, 1L, Long::sum);
            }
        }
        stats.put("categoryStats", categoryStats);

        return stats;
    }

    /**
     * 获取用户最近答题记录
     */
    public List<QuizRecordResponse> getRecentRecords(Long userId, int limit) {
        List<QuizHistory> records = quizHistoryRepository.findTop10ByUserIdOrderByUpdatedAtDesc(userId);

        return records.stream()
                .limit(limit)
                .map(this::toRecordResponse)
                .collect(Collectors.toList());
    }

    private QuizRecordResponse toRecordResponse(QuizHistory qh) {
        return QuizRecordResponse.builder()
                .id(qh.getId())
                .title(qh.getTitle())
                .questionCategory(qh.getQuestionCategory())
                .contentCategory(qh.getContentCategory())
                .totalQuestions(qh.getTotalQuestions())
                .correctCount(qh.getCorrectCount() != null ? qh.getCorrectCount() : 0)
                .wrongCount(qh.getWrongCount() != null ? qh.getWrongCount() : 0)
                .obtainedScore(qh.getObtainedScore() != null ? qh.getObtainedScore() : 0)
                .totalScore(qh.getTotalScore() != null ? qh.getTotalScore() : 0)
                .totalTimeSeconds(qh.getTotalTimeSeconds() != null ? qh.getTotalTimeSeconds() : 0)
                .completionStatus(qh.getCompletionStatus())
                .createdAt(qh.getCreatedAt() != null ? qh.getCreatedAt().toString() : null)
                .updatedAt(qh.getUpdatedAt() != null ? qh.getUpdatedAt().toString() : null)
                .build();
    }
}
