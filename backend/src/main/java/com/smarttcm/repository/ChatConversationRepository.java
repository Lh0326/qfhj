package com.smarttcm.repository;

import com.smarttcm.entity.ChatConversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * ChatConversation Repository - 对话会话数据访问层
 */
@Repository
public interface ChatConversationRepository extends JpaRepository<ChatConversation, Long> {

    /**
     * 分页查询用户的所有会话
     */
    Page<ChatConversation> findByUserIdOrderByUpdatedAtDesc(Long userId, Pageable pageable);

    /**
     * 查询用户会话详情（含消息）
     */
    @Query("SELECT c FROM ChatConversation c LEFT JOIN FETCH c.messages WHERE c.id = :id AND c.userId = :userId")
    Optional<ChatConversation> findByIdAndUserIdWithMessages(@Param("id") Long id, @Param("userId") Long userId);

    /**
     * 查询用户会话（不含消息）
     */
    Optional<ChatConversation> findByIdAndUserId(Long id, Long userId);

    /**
     * 删除用户会话
     */
    void deleteByIdAndUserId(Long id, Long userId);

    /**
     * 统计用户会话数量
     */
    long countByUserId(Long userId);

    /**
     * 查询用户最新的会话
     */
    Optional<ChatConversation> findFirstByUserIdOrderByUpdatedAtDesc(Long userId);
}