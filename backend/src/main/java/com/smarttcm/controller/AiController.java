package com.smarttcm.controller;

import com.smarttcm.dto.AiChatRequest;
import com.smarttcm.dto.AiChatResponse;
import com.smarttcm.entity.User;
import com.smarttcm.service.ChatService;
import com.smarttcm.service.DeepSeekService;
import com.smarttcm.dto.DeepSeekRequest;
import com.smarttcm.dto.SaveConversationRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.List;

/**
 * AI 中医问诊控制器
 * 处理前端中医问诊聊天请求
 */
@RestController
@RequestMapping("/ai")
@Tag(name = "中医问诊", description = "AI 中医问诊聊天接口")
@SecurityRequirement(name = "Bearer Authentication")
public class AiController {

    private static final Logger log = LoggerFactory.getLogger(AiController.class);

    private final DeepSeekService deepSeekService;
    private final ChatService chatService;

    @Autowired
    public AiController(DeepSeekService deepSeekService, ChatService chatService) {
        this.deepSeekService = deepSeekService;
        this.chatService = chatService;
    }

    /**
     * AI 聊天（非流式）
     */
    @PostMapping("/chat")
    @Operation(summary = "中医问诊", description = "发送症状描述并获取 AI 中医辨证分析（非流式）")
    public ResponseEntity<AiChatResponse> chat(
            @AuthenticationPrincipal User currentUser,
            @RequestBody AiChatRequest request) {
        log.info("TCM chat request from user: {}", currentUser != null ? currentUser.getUsername() : "anonymous");

        try {
            List<DeepSeekRequest.Message> history = deepSeekService.parseHistory(request.getHistory());
            String content = deepSeekService.chatWithHistory(
                    DeepSeekService.TCM_DIAGNOSIS_SYSTEM_PROMPT,
                    request.getMessage(),
                    history
            );

            if (content == null) {
                return ResponseEntity.internalServerError()
                        .body(AiChatResponse.builder()
                                .success(false)
                                .error("AI 服务暂时不可用，请稍后重试")
                                .build());
            }

            AiChatResponse response = AiChatResponse.builder()
                    .success(true)
                    .content(content)
                    .build();

            // 自动保存对话到数据库
            if (currentUser != null) {
                autoSaveConversation(currentUser.getId(), request, response);
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Chat error: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(AiChatResponse.builder()
                            .success(false)
                            .error("服务器错误: " + e.getMessage())
                            .build());
        }
    }

    /**
     * AI 聊天（流式 SSE）
     */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "中医问诊（流式）", description = "发送症状描述并获取 AI 中医辨证分析（流式输出），自动保存对话")
    public SseEmitter streamChat(
            @AuthenticationPrincipal User currentUser,
            @RequestBody AiChatRequest request) {
        log.info("TCM stream chat request from user: {}", currentUser != null ? currentUser.getUsername() : "anonymous");

        try {
            List<DeepSeekRequest.Message> history = deepSeekService.parseHistory(request.getHistory());

            return deepSeekService.streamChat(
                    DeepSeekService.TCM_DIAGNOSIS_SYSTEM_PROMPT,
                    request.getMessage(),
                    history,
                    null,  // TCM 问诊不需要推荐题目
                    currentUser,
                    request,
                    chatService
            );
        } catch (Exception e) {
            log.error("Stream chat error: {}", e.getMessage(), e);
            SseEmitter emitter = new SseEmitter();
            emitter.completeWithError(e);
            return emitter;
        }
    }

    /**
     * 自动保存对话到数据库
     */
    private void autoSaveConversation(Long userId, AiChatRequest request, AiChatResponse response) {
        try {
            List<SaveConversationRequest.MessageDto> messages = new ArrayList<>();

            if (request.getHistory() != null) {
                for (AiChatRequest.ChatMessage chatMsg : request.getHistory()) {
                    messages.add(SaveConversationRequest.MessageDto.builder()
                            .role(chatMsg.getRole())
                            .content(chatMsg.getContent())
                            .build());
                }
            }

            messages.add(SaveConversationRequest.MessageDto.builder()
                    .role("user")
                    .content(request.getMessage())
                    .build());

            messages.add(SaveConversationRequest.MessageDto.builder()
                    .role("assistant")
                    .content(response.getContent())
                    .build());

            SaveConversationRequest saveRequest = SaveConversationRequest.builder()
                    .id(request.getConversationId())
                    .title(request.getTitle())
                    .messages(messages)
                    .build();

            chatService.saveConversation(userId, saveRequest);
            log.info("自动保存对话成功: userId={}, conversationId={}", userId, request.getConversationId());
        } catch (Exception e) {
            log.error("自动保存对话失败: {}", e.getMessage(), e);
        }
    }
}
