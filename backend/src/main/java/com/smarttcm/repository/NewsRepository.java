package com.smarttcm.repository;

import com.smarttcm.entity.News;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * News Repository - 热点新闻数据访问层
 */
@Repository
public interface NewsRepository extends JpaRepository<News, Long>, JpaSpecificationExecutor<News> {

    /**
     * 按状态分页查询新闻
     */
    Page<News> findByStatus(String status, Pageable pageable);

    /**
     * 按分类分页查询新闻
     */
    Page<News> findByCategory(String category, Pageable pageable);

    /**
     * 查询最新的原始新闻（用于AI题目生成）
     * 按 fetchedAt 倒序排列
     */
    @Query("SELECT n FROM News n WHERE n.status = 'raw' ORDER BY n.fetchedAt DESC")
    List<News> findTopRawNews(Pageable pageable);

    /**
     * 按状态统计新闻数量
     */
    long countByStatus(String status);

    /**
     * 获取所有新闻的 URL（用于去重）
     */
    @Query("SELECT n.url FROM News n WHERE n.url IS NOT NULL")
    List<String> findAllUrls();
}