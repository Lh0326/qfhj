package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Question Response DTO - 题目响应数据传输对象
 * 用于返回给前端的知识条目详情
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionResponse {

    private Long id;
    private String competition;
    private String yearStage;
    private String questionType;
    private String questionCategory;
    private String contentCategory;
    private String question;
    private String options;
    private String answer;
    private String answerImageUrl;
    private String questionImageUrl;
    private String mediaUrl;
    private String answerOnly;
    private String knowledgePoint;
    private String primaryProject;
    private String secondaryProject;
    private String culturalPoint;
    private String fourStageCognition;
    private String bloomCognitionLevel;
    private String coreConnotation;
    private String whyQuestion;
    private String mainFocus;
    private String textLevel;
    private String createdAt;
    private String updatedAt;
}
