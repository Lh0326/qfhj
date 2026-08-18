package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * AI 聊天响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiChatResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * AI 回复内容（非流式时返回）
     */
    private String content;

    /**
     * 错误信息
     */
    private String error;

    /**
     * token 使用统计
     */
    private TokenUsage usage;

    /**
     * 推荐题目 ID 列表
     */
    private List<RecommendedQuestion> recommendedQuestions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecommendedQuestion {
        private Long id;
        private double score;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TokenUsage {
        private int promptTokens;
        private int completionTokens;
        private int totalTokens;
    }
}
