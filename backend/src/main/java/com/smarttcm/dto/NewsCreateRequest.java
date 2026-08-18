package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * News Create Request - 新闻创建请求
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NewsCreateRequest {

    private String title;

    private String content;

    private String source;

    private String url;

    private String category;

    private LocalDateTime publishedAt;
}
