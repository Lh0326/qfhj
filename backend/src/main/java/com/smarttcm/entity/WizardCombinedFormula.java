package com.smarttcm.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * WizardCombinedFormula Entity - 合病合方实体
 */
@Entity
@Table(name = "wizard_combined_formula", indexes = {
    @Index(name = "idx_combined_session", columnList = "session_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WizardCombinedFormula {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "has_combined")
    @Builder.Default
    private Boolean hasCombined = false;

    @Column(name = "combined_syndromes", columnDefinition = "TEXT")
    private String combinedSyndromes;

    @Column(name = "recommended_formula", columnDefinition = "TEXT")
    private String recommendedFormula;

    @Column(name = "is_applied")
    @Builder.Default
    private Boolean isApplied = false;

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
