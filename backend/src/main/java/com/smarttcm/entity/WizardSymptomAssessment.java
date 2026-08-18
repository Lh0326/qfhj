package com.smarttcm.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * WizardSymptomAssessment Entity - 症状评估实体
 */
@Entity
@Table(name = "wizard_symptom_assessment", indexes = {
    @Index(name = "idx_assessment_session", columnList = "session_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WizardSymptomAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "symptom_id")
    private Long symptomId;

    @Column(name = "symptom_name", length = 100)
    private String symptomName;

    @Column(name = "severity", length = 20)
    private String severity;

    @Column(name = "skip_assessment")
    @Builder.Default
    private Boolean skipAssessment = false;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
