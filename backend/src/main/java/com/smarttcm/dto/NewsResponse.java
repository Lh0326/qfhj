package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * News Response DTO - 新闻响应体
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NewsResponse {

    private Long id;
    private String title;
    private String content;
    private String source;
    private String url;
    private LocalDateTime publishedAt;
    private LocalDateTime fetchedAt;
    private String category;
    private String status;
}
