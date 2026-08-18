package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * News Stats Response DTO - 新闻统计响应体
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NewsStatsResponse {

    private long total;
    private long raw;
    private long used;
    private long expired;
}
