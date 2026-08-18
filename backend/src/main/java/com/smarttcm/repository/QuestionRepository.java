package com.smarttcm.repository;

import com.smarttcm.entity.Question;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Question Repository - 题目数据访问层
 */
@Repository
public interface QuestionRepository extends JpaRepository<Question, Long>, JpaSpecificationExecutor<Question> {

    /**
     * 按题目大类查询
     */
    Page<Question> findByQuestionCategory(String questionCategory, Pageable pageable);

    /**
     * 按内容子类查询
     */
    Page<Question> findByContentCategory(String contentCategory, Pageable pageable);

    /**
     * 按题型查询
     */
    Page<Question> findByQuestionType(String questionType, Pageable pageable);

    /**
     * 按一级项目查询
     */
    Page<Question> findByPrimaryProject(String primaryProject, Pageable pageable);

    /**
     * 全文搜索（question, answer, knowledge_point 字段）
     */
    @Query("SELECT q FROM Question q WHERE " +
            "LOWER(q.question) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(q.answer) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(q.knowledgePoint) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(q.options) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    Page<Question> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);

    /**
     * 获取所有不同的题目大类
     */
    @Query("SELECT DISTINCT q.questionCategory FROM Question q WHERE q.questionCategory IS NOT NULL ORDER BY q.questionCategory")
    List<String> findDistinctQuestionCategories();

    /**
     * 获取所有不同的内容子类
     */
    @Query("SELECT DISTINCT q.contentCategory FROM Question q WHERE q.contentCategory IS NOT NULL ORDER BY q.contentCategory")
    List<String> findDistinctContentCategories();

    /**
     * 获取所有不同的题型
     */
    @Query("SELECT DISTINCT q.questionType FROM Question q WHERE q.questionType IS NOT NULL ORDER BY q.questionType")
    List<String> findDistinctQuestionTypes();

    /**
     * 获取所有不同的一级项目
     */
    @Query("SELECT DISTINCT q.primaryProject FROM Question q WHERE q.primaryProject IS NOT NULL ORDER BY q.primaryProject")
    List<String> findDistinctPrimaryProjects();

    /**
     * 获取所有不同的二级项目
     */
    @Query("SELECT DISTINCT q.secondaryProject FROM Question q WHERE q.secondaryProject IS NOT NULL ORDER BY q.secondaryProject")
    List<String> findDistinctSecondaryProjects();

    /**
     * 获取所有不同的竞赛
     */
    @Query("SELECT DISTINCT q.competition FROM Question q WHERE q.competition IS NOT NULL ORDER BY q.competition")
    List<String> findDistinctCompetitions();

    /**
     * 获取所有不同的学段
     */
    @Query("SELECT DISTINCT q.yearStage FROM Question q WHERE q.yearStage IS NOT NULL ORDER BY q.yearStage")
    List<String> findDistinctYearStages();

    /**
     * 按大类统计题目数量
     */
    @Query("SELECT q.questionCategory, COUNT(q) FROM Question q WHERE q.questionCategory IS NOT NULL GROUP BY q.questionCategory ORDER BY q.questionCategory")
    List<Object[]> countByQuestionCategory();

    /**
     * 统计总题目数
     */
    long count();
}
