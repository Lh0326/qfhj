package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Quiz Record Response DTO - 答题记录响应
 * 用于个人中心展示用户最近的答题记录
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuizRecordResponse {

    private Long id;
    private String title;
    private String questionCategory;
    private String contentCategory;
    private int totalQuestions;
    private int correctCount;
    private int wrongCount;
    private int obtainedScore;
    private int totalScore;
    private int totalTimeSeconds;
    private String completionStatus;
    private String createdAt;
    private String updatedAt;
}
