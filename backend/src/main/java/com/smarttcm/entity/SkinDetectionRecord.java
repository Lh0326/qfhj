package com.smarttcm.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "skin_detection_records")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkinDetectionRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "result_json", columnDefinition = "TEXT")
    private String resultJson;

    @Column(name = "disease_label", length = 200)
    private String diseaseLabel;

    @Column(name = "confidence_score")
    private Double confidenceScore;

    @Column(name = "tcm_analysis", columnDefinition = "TEXT")
    private String tcmAnalysis;

    @Column(name = "western_diagnosis", columnDefinition = "TEXT")
    private String westernDiagnosis;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
