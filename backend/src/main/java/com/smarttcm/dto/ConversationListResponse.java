package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 对话列表响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationListResponse {

    private List<ConversationItem> items;
    private long total;
    private int page;
    private int size;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConversationItem {
        private Long id;
        private String title;
        private String lastMessage;
        private Integer messageCount;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
}