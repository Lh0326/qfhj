package com.smarttcm.service;

import com.smarttcm.dto.NewsResponse;
import com.smarttcm.entity.News;
import com.smarttcm.repository.NewsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * News Service - 热点新闻服务
 * 管理新闻记录，支持基础的 CRUD 操作
 */
@Service
public class NewsService {

    private static final Logger log = LoggerFactory.getLogger(NewsService.class);

    private final NewsRepository newsRepository;

    public NewsService(NewsRepository newsRepository) {
        this.newsRepository = newsRepository;
    }

    /**
     * 分页获取新闻列表
     */
    public Page<News> getNewsPage(String status, String category, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "fetchedAt"));

        if (status != null && !status.isEmpty()) {
            return newsRepository.findByStatus(status, pageRequest);
        } else if (category != null && !category.isEmpty()) {
            return newsRepository.findByCategory(category, pageRequest);
        }
        return newsRepository.findAll(pageRequest);
    }

    /**
     * 根据ID获取新闻
     */
    public Optional<News> getNewsById(Long id) {
        return newsRepository.findById(id);
    }

    /**
     * 创建新闻
     */
    @Transactional
    public News createNews(News news) {
        return newsRepository.save(news);
    }

    /**
     * 更新新闻状态
     */
    @Transactional
    public Optional<News> updateStatus(Long id, String status) {
        return newsRepository.findById(id).map(news -> {
            news.setStatus(status);
            return newsRepository.save(news);
        });
    }

    /**
     * 删除新闻
     */
    @Transactional
    public boolean deleteNews(Long id) {
        if (newsRepository.existsById(id)) {
            newsRepository.deleteById(id);
            return true;
        }
        return false;
    }

    /**
     * 获取待生成题目的原始新闻
     */
    public List<News> getRawNews(int limit) {
        return newsRepository.findTopRawNews(PageRequest.of(0, limit));
    }

    /**
     * 按状态统计新闻数量
     */
    public long countByStatus(String status) {
        return newsRepository.countByStatus(status);
    }

    /**
     * 获取新闻总数
     */
    public long countAll() {
        return newsRepository.count();
    }

    /**
     * 转换为响应对象
     */
    public NewsResponse toResponse(News news) {
        return NewsResponse.builder()
                .id(news.getId())
                .title(news.getTitle())
                .content(news.getContent())
                .source(news.getSource())
                .url(news.getUrl())
                .publishedAt(news.getPublishedAt())
                .fetchedAt(news.getFetchedAt())
                .category(news.getCategory())
                .status(news.getStatus())
                .build();
    }

    /**
     * 转换为响应列表
     */
    public List<NewsResponse> toResponseList(List<News> newsList) {
        return newsList.stream().map(this::toResponse).collect(Collectors.toList());
    }
}
