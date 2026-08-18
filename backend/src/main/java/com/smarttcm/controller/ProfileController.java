package com.smarttcm.controller;

import com.smarttcm.dto.ApiResponse;
import com.smarttcm.dto.QuizRecordResponse;
import com.smarttcm.entity.User;
import com.smarttcm.service.QuizHistoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Profile Controller - 个人中心控制器
 * 处理用户个人中心的统计和记录接口
 */
@RestController
@RequestMapping("/profile")
@Tag(name = "个人中心", description = "用户个人中心的统计和记录接口")
public class ProfileController {

    private final QuizHistoryService quizHistoryService;

    public ProfileController(QuizHistoryService quizHistoryService) {
        this.quizHistoryService = quizHistoryService;
    }

    /**
     * 获取用户学习统计
     * GET /api/v1/profile/stats
     */
    @Operation(
            summary = "获取学习统计",
            description = "获取用户的学习统计信息，包括总答题数、正确率、学习时长、学习进度等"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStats(
            @AuthenticationPrincipal User currentUser) {
        Map<String, Object> stats = quizHistoryService.getQuizHistoryStats(currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    /**
     * 获取最近答题记录
     * GET /api/v1/profile/records/recent
     */
    @Operation(
            summary = "获取最近答题记录",
            description = "获取用户最近的答题记录列表，按最近更新时间排序，每条记录包含完整的题目详情和用户答题情况"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @GetMapping("/records/recent")
    public ResponseEntity<ApiResponse<List<QuizRecordResponse>>> getRecentRecords(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "10") int limit) {
        List<QuizRecordResponse> records = quizHistoryService.getRecentRecords(currentUser.getId(), limit);
        return ResponseEntity.ok(ApiResponse.success(records));
    }

}
