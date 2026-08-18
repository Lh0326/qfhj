package com.smarttcm.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * WizardDurationRecord Entity - 六经传变持续时日记录实体
 */
@Entity
@Table(name = "wizard_duration_record", indexes = {
    @Index(name = "idx_duration_session", columnList = "session_id"),
    @Index(name = "idx_duration_assessment", columnList = "assessment_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WizardDurationRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "assessment_id")
    private Long assessmentId;

    @Column(name = "symptom_name", length = 100)
    private String symptomName;

    @Column(name = "duration_days")
    private Integer durationDays;

    @Column(name = "duration_hours")
    private Integer durationHours;

    @Column(name = "liu_jing_stage", length = 50)
    private String liuJingStage;

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
