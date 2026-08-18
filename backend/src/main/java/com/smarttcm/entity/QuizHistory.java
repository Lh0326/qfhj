package com.smarttcm.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * QuizHistory Entity - 答题历史记录实体类
 */
@Entity
@Table(name = "quiz_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuizHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "title", length = 200)
    private String title;

    @Column(name = "question_ids", columnDefinition = "TEXT")
    private String questionIds;

    @Column(name = "answers", columnDefinition = "TEXT")
    private String answers;

    @Column(name = "total_questions", nullable = false)
    private Integer totalQuestions;

    @Column(name = "correct_count")
    private Integer correctCount;

    @Column(name = "wrong_count")
    private Integer wrongCount;

    @Column(name = "unanswered_count")
    private Integer unansweredCount;

    @Column(name = "obtained_score")
    private Integer obtainedScore;

    @Column(name = "total_score")
    private Integer totalScore;

    @Column(name = "total_time_seconds")
    private Integer totalTimeSeconds;

    @Column(name = "completion_status", length = 20)
    private String completionStatus;

    @Column(name = "source", length = 20)
    private String source;

    @Column(name = "question_category", length = 50)
    private String questionCategory;

    @Column(name = "content_category", columnDefinition = "TEXT")
    private String contentCategory;

    @Column(name = "primary_project", length = 100)
    private String primaryProject;

    @Column(name = "secondary_project", length = 100)
    private String secondaryProject;

    @Column(name = "competition", length = 100)
    private String competition;

    @Column(name = "quiz_config", columnDefinition = "TEXT")
    private String quizConfig;

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
