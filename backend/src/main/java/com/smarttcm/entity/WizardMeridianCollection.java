package com.smarttcm.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * WizardMeridianCollection Entity - 子午归经采集实体
 */
@Entity
@Table(name = "wizard_meridian_collection", indexes = {
    @Index(name = "idx_meridian_session", columnList = "session_id"),
    @Index(name = "idx_meridian_assessment", columnList = "assessment_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WizardMeridianCollection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "assessment_id")
    private Long assessmentId;

    @Column(name = "symptom_name", length = 100)
    private String symptomName;

    @Column(name = "attack_time", length = 50)
    private String attackTime;

    @Column(name = "attack_meridian", length = 50)
    private String attackMeridian;

    @Column(name = "body_type", length = 50)
    private String bodyType;

    @Column(name = "environment_factors", length = 200)
    private String environmentFactors;

    @Column(name = "tongue_coating", length = 100)
    private String tongueCoating;

    @Column(name = "tongue_body", length = 100)
    private String tongueBody;

    @Column(name = "pulse_type", length = 100)
    private String pulseType;

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
