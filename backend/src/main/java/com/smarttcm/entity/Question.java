package com.smarttcm.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Question Entity - 中医知识题目实体类
 * 映射到 questions 表，包含题库中所有题目的完整信息
 */
@Entity
@Table(name = "questions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "question", nullable = false, columnDefinition = "TEXT")
    private String question;

    @Column(name = "options", columnDefinition = "TEXT")
    private String options;

    @Column(name = "answer", columnDefinition = "TEXT")
    private String answer;

    @Column(name = "answer_image_url", length = 500)
    private String answerImageUrl;

    @Column(name = "answer_only", columnDefinition = "TEXT")
    private String answerOnly;

    @Column(name = "question_image_url", length = 500)
    private String questionImageUrl;

    @Column(name = "media_url", length = 500)
    private String mediaUrl;

    @Column(name = "question_type", length = 50)
    private String questionType;

    @Column(name = "question_category", length = 50)
    private String questionCategory;

    @Column(name = "content_category", columnDefinition = "TEXT")
    private String contentCategory;

    @Column(name = "knowledge_point", columnDefinition = "TEXT")
    private String knowledgePoint;

    @Column(name = "primary_project", length = 100)
    private String primaryProject;

    @Column(name = "secondary_project", length = 100)
    private String secondaryProject;

    @Column(name = "competition", length = 100)
    private String competition;

    @Column(name = "year_stage", columnDefinition = "TEXT")
    private String yearStage;

    @Column(name = "bloom_cognition_level", length = 100)
    private String bloomCognitionLevel;

    @Column(name = "core_connotation", columnDefinition = "TEXT")
    private String coreConnotation;

    @Column(name = "cultural_point", length = 200)
    private String culturalPoint;

    @Column(name = "four_stage_cognition", length = 100)
    private String fourStageCognition;

    @Column(name = "main_focus", length = 200)
    private String mainFocus;

    @Column(name = "text_level", length = 10)
    private String textLevel;

    @Column(name = "why_question", length = 200)
    private String whyQuestion;

    @Column(name = "news_id")
    private Long newsId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
