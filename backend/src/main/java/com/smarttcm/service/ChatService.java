package com.smarttcm.service;

import com.smarttcm.dto.*;
import com.smarttcm.entity.ChatConversation;
import com.smarttcm.entity.ChatMessage;
import com.smarttcm.entity.ChatMessage.MessageRole;
import com.smarttcm.repository.ChatConversationRepository;
import com.smarttcm.repository.ChatMessageRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * ChatService - 对话服务
 * 处理对话会话的创建、更新、查询、删除等业务逻辑
 */
@Service
public class ChatService {

    private static final Logger logger = LoggerFactory.getLogger(ChatService.class);

    private final ChatConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;
    private final ObjectMapper objectMapper;

    public ChatService(ChatConversationRepository conversationRepository,
                      ChatMessageRepository messageRepository,
                      ObjectMapper objectMapper) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * 保存对话（创建或更新）
     */
    @Transactional
    public SaveConversationResponse saveConversation(Long userId, SaveConversationRequest request) {
        ChatConversation conversation;

        if (request.getId() != null) {
            conversation = conversationRepository.findByIdAndUserId(request.getId(), userId)
                    .orElseThrow(() -> new RuntimeException("对话不存在或无权访问"));
            conversation.getMessages().clear();
        } else {
            conversation = new ChatConversation();
            conversation.setUserId(userId);
        }

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            conversation.setTitle(request.getTitle());
        } else if (request.getMessages() != null && !request.getMessages().isEmpty()) {
            String firstUserMessage = request.getMessages().stream()
                    .filter(m -> "user".equals(m.getRole()))
                    .findFirst()
                    .map(m -> m.getContent().substring(0, Math.min(m.getContent().length(), 50)))
                    .orElse("新对话");
            conversation.setTitle(firstUserMessage + (firstUserMessage.length() >= 50 ? "..." : ""));
        }

        if (request.getMessages() != null) {
            for (SaveConversationRequest.MessageDto msgDto : request.getMessages()) {
                ChatMessage message = ChatMessage.builder()
                        .role(MessageRole.valueOf(msgDto.getRole()))
                        .content(msgDto.getContent())
                        .recommendedQuestions(toJson(msgDto.getRecommendedQuestions()))
                        .build();
                conversation.addMessage(message);
            }
        }

        conversation = conversationRepository.save(conversation);
        logger.info("保存对话成功: id={}, userId={}, title={}", conversation.getId(), userId, conversation.getTitle());

        return SaveConversationResponse.builder()
                .id(conversation.getId())
                .title(conversation.getTitle())
                .updatedAt(conversation.getUpdatedAt())
                .build();
    }

    /**
     * 获取对话历史列表（分页）
     */
    public ConversationListResponse getConversationList(Long userId, int page, int size) {
        // 前端使用1-based页码，Spring Data JPA使用0-based索引
        Pageable pageable = PageRequest.of(page - 1, size);
        Page<ChatConversation> conversationPage = conversationRepository.findByUserIdOrderByUpdatedAtDesc(userId, pageable);

        List<ConversationListResponse.ConversationItem> items = conversationPage.getContent().stream()
                .map(this::toConversationItem)
                .collect(Collectors.toList());

        return ConversationListResponse.builder()
                .items(items)
                .total(conversationPage.getTotalElements())
                .page(page)
                .size(size)
                .build();
    }

    /**
     * 获取单个对话详情
     */
    public ConversationDetailResponse getConversationDetail(Long id, Long userId) {
        ChatConversation conversation = conversationRepository.findByIdAndUserIdWithMessages(id, userId)
                .orElseThrow(() -> new RuntimeException("对话不存在或无权访问"));

        return toConversationDetailResponse(conversation);
    }

    /**
     * 删除对话
     */
    @Transactional
    public void deleteConversation(Long id, Long userId) {
        ChatConversation conversation = conversationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new RuntimeException("对话不存在或无权访问"));
        conversationRepository.delete(conversation);
        logger.info("删除对话成功: id={}, userId={}", id, userId);
    }

    private ConversationListResponse.ConversationItem toConversationItem(ChatConversation conversation) {
        String lastMessage = "";
        int messageCount = (int) messageRepository.countByConversationId(conversation.getId());
        if (messageCount > 0) {
            ChatMessage lastMsg = messageRepository.findLastMessageByConversationId(conversation.getId());
            if (lastMsg != null) {
                lastMessage = lastMsg.getContent().substring(0, Math.min(lastMsg.getContent().length(), 100));
            }
        }

        return ConversationListResponse.ConversationItem.builder()
                .id(conversation.getId())
                .title(conversation.getTitle())
                .lastMessage(lastMessage)
                .messageCount(messageCount)
                .createdAt(conversation.getCreatedAt())
                .updatedAt(conversation.getUpdatedAt())
                .build();
    }

    private ConversationDetailResponse toConversationDetailResponse(ChatConversation conversation) {
        List<ConversationDetailResponse.MessageResponse> messages = conversation.getMessages().stream()
                .map(this::toMessageResponse)
                .collect(Collectors.toList());

        return ConversationDetailResponse.builder()
                .id(conversation.getId())
                .title(conversation.getTitle())
                .messages(messages)
                .createdAt(conversation.getCreatedAt())
                .updatedAt(conversation.getUpdatedAt())
                .build();
    }

    private ConversationDetailResponse.MessageResponse toMessageResponse(ChatMessage message) {
        return ConversationDetailResponse.MessageResponse.builder()
                .id(message.getId())
                .role(message.getRole().name())
                .content(message.getContent())
                .timestamp(message.getCreatedAt())
                .recommendedQuestions(fromJson(message.getRecommendedQuestions()))
                .build();
    }

    private String toJson(List<SaveConversationRequest.RecommendedQuestion> questions) {
        if (questions == null || questions.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(questions);
        } catch (JsonProcessingException e) {
            logger.error("序列化推荐题目失败", e);
            return null;
        }
    }

    private List<SaveConversationRequest.RecommendedQuestion> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<SaveConversationRequest.RecommendedQuestion>>() {});
        } catch (JsonProcessingException e) {
            logger.error("反序列化推荐题目失败", e);
            return null;
        }
    }
}