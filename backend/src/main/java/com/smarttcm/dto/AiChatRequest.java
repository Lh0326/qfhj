package com.smarttcm.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * AI 聊天请求 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiChatRequest {

    @NotBlank(message = "消息内容不能为空")
    private String message;

    /**
     * 对话历史（之前的消息）
     */
    private List<ChatMessage> history;

    /**
     * 是否使用流式输出
     */
    private Boolean stream = false;

    /**
     * 对话ID（用于更新已有对话）
     */
    private Long conversationId;

    /**
     * 对话标题
     */
    private String title;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatMessage {
        private String role;      // system, user, assistant
        private String content;
    }
}
