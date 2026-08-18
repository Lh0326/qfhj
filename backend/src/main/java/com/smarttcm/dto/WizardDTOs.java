package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * WizardDTOs - 向导式问诊所有DTO集合
 */
public class WizardDTOs {

    /**
     * 创建问诊会话请求
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateSessionRequest {
        private String patientName;
    }

    /**
     * 问诊会话响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SessionResponse {
        private Long id;
        private String patientName;
        private Integer currentStep;
        private String status;
        private LocalDateTime createdAt;
    }

    /**
     * 第一步请求 - 症状选择与评估
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step1Request {
        private Long sessionId;
        private List<SymptomAssessmentItem> symptoms;
    }

    /**
     * 症状评估项
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SymptomAssessmentItem {
        private Long symptomId;
        private String symptomName;
        private String severity;
        private Boolean skipAssessment;
    }

    /**
     * 第二步请求 - 子午归经采集
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step2Request {
        private Long sessionId;
        private String bodyType;
        private String environmentFactors;
        private String tongueCoating;
        private String tongueBody;
        private String pulseType;
        private List<MeridianItem> meridians;
        private SupplementaryInquiry supplementaryInquiry;
    }

    /**
     * 补充问诊（十问歌详查）
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SupplementaryInquiry {
        private String coldHeat;
        private String sweating;
        private String bowel;
        private String urine;
        private String sleep;
        private String taste;
        private String complexion;
        private List<SymptomSpecificDetail> symptomDetails;
    }

    /**
     * 症状特异性补充信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SymptomSpecificDetail {
        private Long assessmentId;
        private String symptomName;
        private String painLocation;
        private String painNature;
        private String sputumType;
        private String digestionDetail;
        private String emotionDetail;
    }

    /**
     * 子午归经项
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MeridianItem {
        private Long assessmentId;
        private String symptomName;
        private String attackTime;
        private String attackMeridian;
    }

    /**
     * 第三步请求 - 六经传变持续时日
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step3Request {
        private Long sessionId;
        private List<DurationItem> durations;
    }

    /**
     * 持续时日项
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DurationItem {
        private Long assessmentId;
        private String symptomName;
        private Integer durationDays;
        private Integer durationHours;
        private String liuJingStage;
    }

    /**
     * AI诊断响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DiagnosisResponse {
        private Long id;
        private String primarySyndrome;
        private String secondarySyndromes;
        private String treatmentMethod;
        private Double confidenceScore;
        private Map<String, Object> structuredResult;
        private String rawAiResponse;
    }

    /**
     * 第五步请求 - 合病合方
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step5Request {
        private Long sessionId;
        private Boolean hasCombined;
        private String combinedSyndromes;
        private String recommendedFormula;
        private Boolean isApplied;
    }

    /**
     * 第六步请求 - 疗效评估
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step6Request {
        private Long sessionId;
        private String overallEvaluation;
        private String symptomEvaluations;
        private String adjustedPlan;
        private String feedback;
    }

    /**
     * 第七步请求 - 多流派会诊
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step7Request {
        private Long sessionId;
        private String consultationResults;
        private String selectedSchool;
        private String finalPlan;
    }

    /**
     * 症状字典项
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SymptomDictItem {
        private Long id;
        private String name;
        private String category;
        private Boolean isAssessable;
    }

    /**
     * 合病合方响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step5Response {
        private String analysis;
        private String formula;
        private String modification;
    }

    /**
     * 疗效评估响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step6Response {
        private String adjustedPlan;
    }

    /**
     * 多流派会诊响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step7Response {
        private String consultationResults;
        private String finalPlan;
    }

    /**
     * 操作日志响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OperationLogResponse {
        private Long id;
        private Integer stepNo;
        private String operation;
        private String fieldName;
        private String oldValue;
        private String newValue;
        private LocalDateTime createdAt;
    }

    // ─── Step Data Responses (for session resume) ───────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step1DataResponse {
        private Long symptomId;
        private String symptomName;
        private String severity;
        private Boolean skipAssessment;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step2DataResponse {
        private String bodyType;
        private String environmentFactors;
        private String tongueCoating;
        private String tongueBody;
        private String pulseType;
        private List<MeridianItem> meridians;
        private SupplementaryInquiry supplementaryInquiry;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step3DataResponse {
        private Long assessmentId;
        private String symptomName;
        private Integer durationDays;
        private Integer durationHours;
        private String liuJingStage;
    }
}
