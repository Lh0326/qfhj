package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * News List Response DTO - 新闻列表响应体（支持分页）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NewsListResponse {

    private List<NewsResponse> news;
    private long total;
    private int page;
    private int pageSize;
    private int totalPages;

    public static NewsListResponse of(List<NewsResponse> news, long total, int page, int pageSize) {
        return NewsListResponse.builder()
                .news(news)
                .total(total)
                .page(page)
                .pageSize(pageSize)
                .totalPages((int) Math.ceil((double) total / pageSize))
                .build();
    }
}
