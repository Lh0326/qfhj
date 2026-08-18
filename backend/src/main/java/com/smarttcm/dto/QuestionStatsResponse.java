package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Question Stats Response DTO - 题库统计响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionStatsResponse {

    private long totalQuestions;
    private Map<String, Long> categories;
}
