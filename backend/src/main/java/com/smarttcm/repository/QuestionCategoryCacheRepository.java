package com.smarttcm.repository;

import com.smarttcm.entity.QuestionCategoryCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * QuestionCategoryCache Repository - 分类缓存数据访问层
 */
@Repository
public interface QuestionCategoryCacheRepository extends JpaRepository<QuestionCategoryCache, String> {
}
