package com.smarttcm.repository;

import com.smarttcm.entity.WizardSymptomDict;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * WizardSymptomDict Repository - 症状字典数据访问层
 */
@Repository
public interface WizardSymptomDictRepository extends JpaRepository<WizardSymptomDict, Long> {

    /**
     * 按分类查询症状，按排序字段排列
     */
    List<WizardSymptomDict> findByCategoryOrderBySortOrderAsc(String category);

    /**
     * 查询所有症状，按排序字段排列
     */
    List<WizardSymptomDict> findAllByOrderBySortOrderAsc();

    /**
     * 按可评估标志查询
     */
    List<WizardSymptomDict> findByIsAssessableTrueOrderBySortOrderAsc();
}
