package com.smarttcm.controller;

import com.smarttcm.dto.ApiResponse;
import com.smarttcm.dto.WizardDTOs.*;
import com.smarttcm.entity.User;
import com.smarttcm.service.WizardDiagnosisService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * WizardDiagnosisController - 向导式问诊控制器
 * 处理向导式问诊的所有接口
 */
@RestController
@RequestMapping("/wizard-diagnosis")
@Tag(name = "向导式问诊", description = "向导式中医问诊管理接口")
public class WizardDiagnosisController {

    private final WizardDiagnosisService wizardDiagnosisService;

    public WizardDiagnosisController(WizardDiagnosisService wizardDiagnosisService) {
        this.wizardDiagnosisService = wizardDiagnosisService;
    }

    /**
     * 创建问诊会话
     * POST /api/v1/wizard-diagnosis/sessions
     */
    @Operation(
            summary = "创建问诊会话",
            description = "创建新的向导式问诊会话"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @PostMapping("/sessions")
    public ResponseEntity<ApiResponse<SessionResponse>> createSession(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody CreateSessionRequest request) {
        SessionResponse response = wizardDiagnosisService.createSession(currentUser.getId(), request);
        return ResponseEntity.ok(ApiResponse.success("创建问诊会话成功", response));
    }

    /**
     * 获取用户问诊会话列表
     * GET /api/v1/wizard-diagnosis/sessions
     */
    @Operation(
            summary = "获取问诊会话列表",
            description = "获取当前用户的所有问诊会话列表"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<List<SessionResponse>>> listSessions(
            @AuthenticationPrincipal User currentUser) {
        List<SessionResponse> response = wizardDiagnosisService.listSessions(currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 获取问诊会话详情
     * GET /api/v1/wizard-diagnosis/sessions/{id}
     */
    @Operation(
            summary = "获取问诊会话详情",
            description = "根据ID获取问诊会话的详细信息"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @GetMapping("/sessions/{id}")
    public ResponseEntity<ApiResponse<SessionResponse>> getSession(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        SessionResponse response = wizardDiagnosisService.getSession(id, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 保存第一步 - 症状选择与评估
     * POST /api/v1/wizard-diagnosis/sessions/{id}/step1
     */
    @Operation(
            summary = "保存症状选择",
            description = "保存问诊第一步：症状选择与程度评估"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @PostMapping("/sessions/{id}/step1")
    public ResponseEntity<ApiResponse<Void>> saveStep1(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody Step1Request request) {
        request.setSessionId(id);
        wizardDiagnosisService.saveStep1(currentUser.getId(), id, request);
        return ResponseEntity.ok(ApiResponse.success("症状选择保存成功", null));
    }

    /**
     * 保存第二步 - 子午归经采集
     * POST /api/v1/wizard-diagnosis/sessions/{id}/step2
     */
    @Operation(
            summary = "保存子午归经采集",
            description = "保存问诊第二步：子午归经信息、舌诊脉诊"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @PostMapping("/sessions/{id}/step2")
    public ResponseEntity<ApiResponse<Void>> saveStep2(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody Step2Request request) {
        request.setSessionId(id);
        wizardDiagnosisService.saveStep2(currentUser.getId(), id, request);
        return ResponseEntity.ok(ApiResponse.success("子午归经采集保存成功", null));
    }

    /**
     * 保存第三步 - 六经传变持续时日
     * POST /api/v1/wizard-diagnosis/sessions/{id}/step3
     */
    @Operation(
            summary = "保存持续时日",
            description = "保存问诊第三步：各症状的持续时间和六经传变阶段"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @PostMapping("/sessions/{id}/step3")
    public ResponseEntity<ApiResponse<Void>> saveStep3(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody Step3Request request) {
        request.setSessionId(id);
        wizardDiagnosisService.saveStep3(currentUser.getId(), id, request);
        return ResponseEntity.ok(ApiResponse.success("持续时日保存成功", null));
    }

    /**
     * 执行AI诊断
     * POST /api/v1/wizard-diagnosis/sessions/{id}/diagnose
     */
    @Operation(
            summary = "执行AI诊断",
            description = "基于前三步采集的数据调用AI进行中医辨证诊断"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @PostMapping("/sessions/{id}/diagnose")
    public ResponseEntity<ApiResponse<DiagnosisResponse>> runDiagnosis(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        DiagnosisResponse response = wizardDiagnosisService.runDiagnosis(currentUser.getId(), id);
        return ResponseEntity.ok(ApiResponse.success("AI诊断完成", response));
    }

    /**
     * 获取AI诊断结果
     * GET /api/v1/wizard-diagnosis/sessions/{id}/diagnosis
     */
    @Operation(
            summary = "获取诊断结果",
            description = "获取问诊会话的AI诊断结果"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @GetMapping("/sessions/{id}/diagnosis")
    public ResponseEntity<ApiResponse<DiagnosisResponse>> getDiagnosis(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        DiagnosisResponse response = wizardDiagnosisService.getDiagnosis(id, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 保存第五步 - 合病合方
     * POST /api/v1/wizard-diagnosis/sessions/{id}/step5
     */
    @Operation(
            summary = "保存合病合方",
            description = "保存问诊第五步：合病合方分析与推荐"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @PostMapping("/sessions/{id}/step5")
    public ResponseEntity<ApiResponse<Map<String, String>>> saveStep5(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody Step5Request request) {
        request.setSessionId(id);
        Step5Response resp = wizardDiagnosisService.saveStep5(currentUser.getId(), id, request);
        Map<String, String> result = new java.util.HashMap<>();
        if (resp.getAnalysis() != null) result.put("analysis", resp.getAnalysis());
        if (resp.getFormula() != null) result.put("formula", resp.getFormula());
        if (resp.getModification() != null) result.put("modification", resp.getModification());
        return ResponseEntity.ok(ApiResponse.success("合病合方保存成功", result.isEmpty() ? null : result));
    }

    /**
     * 保存第六步 - 疗效评估
     * POST /api/v1/wizard-diagnosis/sessions/{id}/step6
     */
    @Operation(
            summary = "保存疗效评估",
            description = "保存问诊第六步：疗效评估与方案调整"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @PostMapping("/sessions/{id}/step6")
    public ResponseEntity<ApiResponse<Step6Response>> saveStep6(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody Step6Request request) {
        request.setSessionId(id);
        Step6Response response = wizardDiagnosisService.saveStep6(currentUser.getId(), id, request);
        return ResponseEntity.ok(ApiResponse.success("疗效评估保存成功", response));
    }

    /**
     * 保存第七步 - 多流派会诊
     * POST /api/v1/wizard-diagnosis/sessions/{id}/step7
     */
    @Operation(
            summary = "保存多流派会诊",
            description = "保存问诊第七步：多流派会诊结果与最终方案"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @PostMapping("/sessions/{id}/step7")
    public ResponseEntity<ApiResponse<Step7Response>> saveStep7(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody Step7Request request) {
        request.setSessionId(id);
        Step7Response response = wizardDiagnosisService.saveStep7(currentUser.getId(), id, request);
        return ResponseEntity.ok(ApiResponse.success("多流派会诊保存成功", response));
    }

    /**
     * 删除问诊会话
     * DELETE /api/v1/wizard-diagnosis/sessions/{id}
     */
    @Operation(
            summary = "删除问诊会话",
            description = "删除问诊会话及其所有关联数据"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteSession(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        wizardDiagnosisService.deleteSession(id, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success("会话已删除", null));
    }

    /**
     * 归档会话
     * POST /api/v1/wizard-diagnosis/sessions/{id}/complete
     */
    @Operation(
            summary = "归档会话",
            description = "将问诊会话标记为已完成并归档"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @PostMapping("/sessions/{id}/complete")
    public ResponseEntity<ApiResponse<Void>> completeSession(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        wizardDiagnosisService.completeSession(id, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success("会话已归档", null));
    }

    /**
     * 获取症状字典
     * GET /api/v1/wizard-diagnosis/symptoms
     */
    @Operation(
            summary = "获取症状字典",
            description = "获取所有可用症状字典列表"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @GetMapping("/symptoms")
    public ResponseEntity<ApiResponse<List<SymptomDictItem>>> listSymptoms(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String category) {
        List<SymptomDictItem> response;
        if (category != null && !category.isBlank()) {
            response = wizardDiagnosisService.listSymptomsByCategory(category);
        } else {
            response = wizardDiagnosisService.listSymptoms();
        }
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 获取操作日志
     * GET /api/v1/wizard-diagnosis/sessions/{id}/logs
     */
    @Operation(
            summary = "获取操作日志",
            description = "获取问诊会话的操作日志列表"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @GetMapping("/sessions/{id}/logs")
    public ResponseEntity<ApiResponse<List<OperationLogResponse>>> getOperationLogs(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        List<OperationLogResponse> response = wizardDiagnosisService.getOperationLogs(id, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    // ==================== Session Resume: Step Data Endpoints ====================

    @Operation(summary = "获取步骤1数据", description = "获取问诊会话的症状评估数据，用于会话恢复")
    @SecurityRequirement(name = "Bearer Authentication")
    @GetMapping("/sessions/{id}/step1-data")
    public ResponseEntity<ApiResponse<List<Step1DataResponse>>> getStep1Data(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        List<Step1DataResponse> response = wizardDiagnosisService.getStep1Data(id, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "获取步骤2数据", description = "获取问诊会话的子午归经数据，用于会话恢复")
    @SecurityRequirement(name = "Bearer Authentication")
    @GetMapping("/sessions/{id}/step2-data")
    public ResponseEntity<ApiResponse<Step2DataResponse>> getStep2Data(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        Step2DataResponse response = wizardDiagnosisService.getStep2Data(id, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "获取步骤3数据", description = "获取问诊会话的六经传变持续时日数据，用于会话恢复")
    @SecurityRequirement(name = "Bearer Authentication")
    @GetMapping("/sessions/{id}/step3-data")
    public ResponseEntity<ApiResponse<List<Step3DataResponse>>> getStep3Data(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        List<Step3DataResponse> response = wizardDiagnosisService.getStep3Data(id, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
