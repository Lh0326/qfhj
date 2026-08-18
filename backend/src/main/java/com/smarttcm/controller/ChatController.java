package com.smarttcm.controller;

import com.smarttcm.dto.*;
import com.smarttcm.entity.User;
import com.smarttcm.service.ChatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * ChatController - 对话控制器
 * 处理对话会话的保存、查询、删除等接口
 */
@RestController
@RequestMapping("/chat/conversations")
@Tag(name = "对话管理", description = "对话会话的管理接口")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    /**
     * 保存对话（创建或更新）
     * POST /api/v1/chat/conversations
     */
    @Operation(
            summary = "保存对话",
            description = "创建新对话或更新已有对话，支持传入对话标题和消息列表"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @PostMapping
    public ResponseEntity<ApiResponse<SaveConversationResponse>> saveConversation(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody SaveConversationRequest request) {
        SaveConversationResponse response = chatService.saveConversation(currentUser.getId(), request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 获取对话历史列表（分页）
     * GET /api/v1/chat/conversations?page=1&size=20
     */
    @Operation(
            summary = "获取对话历史列表",
            description = "分页获取用户的对话历史记录列表，按更新时间倒序排列"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @GetMapping
    public ResponseEntity<ApiResponse<ConversationListResponse>> getConversationList(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        ConversationListResponse response = chatService.getConversationList(currentUser.getId(), page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 获取单个对话详情
     * GET /api/v1/chat/conversations/{id}
     */
    @Operation(
            summary = "获取对话详情",
            description = "根据ID获取对话的详细信息，包括所有消息"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ConversationDetailResponse>> getConversationDetail(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ConversationDetailResponse response = chatService.getConversationDetail(id, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 删除对话
     * DELETE /api/v1/chat/conversations/{id}
     */
    @Operation(
            summary = "删除对话",
            description = "删除指定的对话记录"
    )
    @SecurityRequirement(name = "Bearer Authentication")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteConversation(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        chatService.deleteConversation(id, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success("删除成功", null));
    }
}