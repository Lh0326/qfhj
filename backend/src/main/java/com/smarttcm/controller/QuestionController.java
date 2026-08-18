package com.smarttcm.controller;

import com.smarttcm.dto.ApiResponse;
import com.smarttcm.dto.CategoryListResponse;
import com.smarttcm.dto.QuestionListResponse;
import com.smarttcm.dto.QuestionResponse;
import com.smarttcm.dto.QuestionStatsResponse;
import com.smarttcm.service.QuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Question Controller - 知识库题目控制器
 * 处理题目的查询、搜索、分类和统计接口
 * 前端 TCMKnowledge 页面依赖此控制器
 */
@RestController
@RequestMapping("/questions")
@Tag(name = "知识库", description = "中医知识库题目查询接口")
public class QuestionController {

    private final QuestionService questionService;

    public QuestionController(QuestionService questionService) {
        this.questionService = questionService;
    }

    /**
     * 获取题目列表（分页+筛选）
     * GET /api/v1/questions/questions
     */
    @Operation(summary = "获取题目列表", description = "分页查询题目列表，支持多种筛选条件")
    @GetMapping("/questions")
    public ResponseEntity<ApiResponse<QuestionListResponse>> getQuestions(
            @Parameter(description = "页码（从0开始）") @RequestParam(defaultValue = "0") int skip,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int limit,
            @Parameter(description = "竞赛") @RequestParam(required = false) String competition,
            @Parameter(description = "学段") @RequestParam(required = false) String yearStage,
            @Parameter(description = "题型") @RequestParam(required = false) String questionType,
            @Parameter(description = "题目大类") @RequestParam(required = false) String questionCategory,
            @Parameter(description = "内容子类") @RequestParam(required = false) String contentCategory,
            @Parameter(description = "一级项目") @RequestParam(required = false) String primaryProject,
            @Parameter(description = "二级项目") @RequestParam(required = false) String secondaryProject,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String searchText) {

        QuestionListResponse data = questionService.getQuestions(
                skip, limit, competition, yearStage, questionType,
                questionCategory, contentCategory, primaryProject, secondaryProject, searchText
        );

        return ResponseEntity.ok(ApiResponse.success("查询成功", data));
    }

    /**
     * 获取题目详情
     * GET /api/v1/questions/questions/{questionId}
     */
    @Operation(summary = "获取题目详情", description = "根据ID获取单个题目的完整详情")
    @GetMapping("/questions/{questionId}")
    public ResponseEntity<ApiResponse<QuestionResponse>> getQuestionDetail(
            @Parameter(description = "题目ID") @PathVariable Long questionId) {

        QuestionResponse data = questionService.getQuestionDetail(questionId);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /**
     * 获取分类选项列表
     * GET /api/v1/questions/categories
     */
    @Operation(summary = "获取分类选项", description = "获取所有可用的分类筛选项，供前端筛选器使用")
    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<CategoryListResponse>> getCategoryOptions() {
        CategoryListResponse data = questionService.getCategoryOptions();
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /**
     * 搜索题目
     * GET /api/v1/questions/search
     */
    @Operation(summary = "搜索题目", description = "根据关键词搜索题目（搜索题干、答案、知识点等字段）")
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<QuestionListResponse>> searchQuestions(
            @Parameter(description = "搜索关键词") @RequestParam String q,
            @Parameter(description = "页码（从0开始）") @RequestParam(defaultValue = "0") int skip,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int limit) {

        QuestionListResponse data = questionService.searchQuestions(q, skip, limit);
        return ResponseEntity.ok(ApiResponse.success("搜索完成", data));
    }

    /**
     * 获取题库统计信息
     * GET /api/v1/questions/stats
     */
    @Operation(summary = "获取统计信息", description = "获取题库总数和各分类题目数量统计")
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<QuestionStatsResponse>> getStats() {
        QuestionStatsResponse data = questionService.getStats();
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /**
     * 获取题目解析
     * GET /api/v1/questions/quiz/explanation/{questionId}
     */
    @Operation(summary = "获取题目解析", description = "获取题目的详细解析和知识点说明")
    @GetMapping("/quiz/explanation/{questionId}")
    public ResponseEntity<ApiResponse<QuestionResponse>> getExplanation(
            @Parameter(description = "题目ID") @PathVariable Long questionId) {

        QuestionResponse data = questionService.getQuestionDetail(questionId);
        return ResponseEntity.ok(ApiResponse.success(data));
    }
}
