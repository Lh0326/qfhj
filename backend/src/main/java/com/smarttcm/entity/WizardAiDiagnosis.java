package com.smarttcm.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * WizardAiDiagnosis Entity - AI诊断结果实体
 */
@Entity
@Table(name = "wizard_ai_diagnosis", indexes = {
    @Index(name = "idx_ai_diag_session", columnList = "session_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WizardAiDiagnosis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "primary_syndrome", length = 200)
    private String primarySyndrome;

    @Column(name = "secondary_syndromes", columnDefinition = "TEXT")
    private String secondarySyndromes;

    @Column(name = "treatment_method", length = 200)
    private String treatmentMethod;

    @Column(name = "confidence_score")
    private Double confidenceScore;

    @Column(name = "raw_ai_response", columnDefinition = "TEXT")
    private String rawAiResponse;

    @Column(name = "structured_result", columnDefinition = "TEXT")
    private String structuredResult;

    @Column(name = "diagnosis_time")
    private LocalDateTime diagnosisTime;

    @PrePersist
    protected void onCreate() {
        if (diagnosisTime == null) {
            diagnosisTime = LocalDateTime.now();
        }
    }
}
