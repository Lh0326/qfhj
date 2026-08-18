package com.smarttcm.service;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

/**
 * QuestionVector Service - 题目向量服务
 * 提供题目向量化和相似度搜索功能
 * 当前为占位实现，向量搜索功能需要部署向量数据库后启用
 */
@Service
public class QuestionVectorService {

    private static final Logger log = LoggerFactory.getLogger(QuestionVectorService.class);

    /**
     * 题目向量搜索结果
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuestionVectorResult {
        private Long questionId;
        private String question;
        private Double similarity;
        private String questionCategory;
        private String contentCategory;
    }

    /**
     * 获取已索引的题目数量
     */
    public int getQuestionCount() {
        return 0;
    }

    /**
     * 异步导入题目到向量数据库
     */
    public void importQuestionsAsync() {
        log.info("题目向量导入功能暂未启用，需要配置向量数据库");
    }

    /**
     * 根据题目ID查找相似题目
     */
    public List<QuestionVectorResult> findSimilarByQuestionId(Long questionId, int topK) {
        log.debug("向量相似度搜索暂未启用");
        return Collections.emptyList();
    }

    /**
     * 根据文本查找相似题目
     */
    public List<QuestionVectorResult> findSimilarByText(String query, int topK) {
        log.debug("向量相似度搜索暂未启用");
        return Collections.emptyList();
    }

    /**
     * 清空向量索引
     */
    public void clearIndex() {
        log.info("向量索引清空（当前为空）");
    }
}
