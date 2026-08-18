package com.smarttcm.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * WizardSupplementaryInquiry Entity - 补充问诊数据实体
 * 存储"十问歌"补充信息及症状特异补充
 */
@Entity
@Table(name = "wizard_supplementary_inquiry", indexes = {
    @Index(name = "idx_supplementary_session", columnList = "session_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WizardSupplementaryInquiry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false, unique = true)
    private Long sessionId;

    @Column(name = "cold_heat", length = 255)
    private String coldHeat;

    @Column(name = "sweating", length = 255)
    private String sweating;

    @Column(name = "bowel", length = 255)
    private String bowel;

    @Column(name = "urine", length = 255)
    private String urine;

    @Column(name = "sleep", length = 255)
    private String sleep;

    @Column(name = "taste", length = 255)
    private String taste;

    @Column(name = "complexion", length = 255)
    private String complexion;

    @Column(name = "symptom_details_json", columnDefinition = "LONGTEXT")
    private String symptomDetailsJson;

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
