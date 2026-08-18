package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 保存对话请求 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaveConversationRequest {

    private Long id;

    private String title;

    private List<MessageDto> messages;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MessageDto {
        private String role;
        private String content;
        private LocalDateTime timestamp;
        private List<RecommendedQuestion> recommendedQuestions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecommendedQuestion {
        private Long questionId;
        private Double score;
    }
}