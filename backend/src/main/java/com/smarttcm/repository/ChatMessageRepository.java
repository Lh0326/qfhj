package com.smarttcm.repository;

import com.smarttcm.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * ChatMessage Repository - 对话消息数据访问层
 */
@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    /**
     * 查询会话的所有消息（按时间升序）
     */
    List<ChatMessage> findByConversationIdOrderByCreatedAtAsc(Long conversationId);

    /**
     * 查询会话的消息数量
     */
    long countByConversationId(Long conversationId);

    /**
     * 删除会话的所有消息
     */
    void deleteByConversationId(Long conversationId);

    /**
     * 获取会话的最后一条消息
     */
    @Query(value = "SELECT * FROM chat_messages WHERE conversation_id = :conversationId ORDER BY created_at DESC LIMIT 1", nativeQuery = true)
    ChatMessage findLastMessageByConversationId(@Param("conversationId") Long conversationId);
}