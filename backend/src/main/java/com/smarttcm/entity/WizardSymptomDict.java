package com.smarttcm.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * WizardSymptomDict Entity - 症状字典实体
 */
@Entity
@Table(name = "wizard_symptom_dict", indexes = {
    @Index(name = "idx_symptom_dict_category", columnList = "category")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WizardSymptomDict {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "category", length = 50)
    private String category;

    @Column(name = "is_assessable")
    @Builder.Default
    private Boolean isAssessable = true;

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;
}
