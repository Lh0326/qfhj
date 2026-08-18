package com.smarttcm.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * News Entity - 热点新闻实体类
 * 用于存储从 EventRegistry API 抓取的热点新闻，作为 AI 题目生成的素材来源
 */
@Entity
@Table(name = "news")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class News {

    public static final String STATUS_RAW = "raw";
    public static final String STATUS_USED = "used";
    public static final String STATUS_EXPIRED = "expired";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 500)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(length = 200)
    private String source;

    @Column(length = 1000)
    private String url;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "fetched_at")
    private LocalDateTime fetchedAt;

    @Column(length = 100)
    private String category;

    /**
     * 状态：raw（待使用）/ used（已生成题目）/ expired（已过期）
     */
    @Column(length = 20)
    private String status = STATUS_RAW;

    /**
     * 原始 JSON 数据（用于调试和重新处理）
     */
    @Column(name = "raw_json", columnDefinition = "TEXT")
    private String rawJson;

    @PrePersist
    protected void onCreate() {
        if (fetchedAt == null) {
            fetchedAt = LocalDateTime.now();
        }
        if (status == null) {
            status = STATUS_RAW;
        }
    }
}
