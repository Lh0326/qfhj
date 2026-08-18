package com.smarttcm.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * QuestionCategoryCache Entity - 题目分类缓存实体
 * 缓存各种分类选项的聚合结果，避免每次请求都查询全表
 */
@Entity
@Table(name = "question_category_cache")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionCategoryCache {

    @Id
    @Column(name = "cacheKey", length = 255)
    private String cacheKey;

    @Column(name = "total_questions")
    private Long totalQuestions;

    @Column(name = "question_categories", columnDefinition = "TEXT")
    private String questionCategories;

    @Column(name = "content_categories", columnDefinition = "TEXT")
    private String contentCategories;

    @Column(name = "question_types", columnDefinition = "TEXT")
    private String questionTypes;

    @Column(name = "primary_projects", columnDefinition = "TEXT")
    private String primaryProjects;

    @Column(name = "secondary_projects", columnDefinition = "TEXT")
    private String secondaryProjects;

    @Column(name = "competitions", columnDefinition = "TEXT")
    private String competitions;

    @Column(name = "year_stages", columnDefinition = "TEXT")
    private String yearStages;

    @Column(name = "last_refreshed_at")
    private LocalDateTime lastRefreshedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        this.lastRefreshedAt = LocalDateTime.now();
    }
}
