package com.smarttcm.controller;

import com.smarttcm.dto.*;
import com.smarttcm.entity.News;
import com.smarttcm.service.NewsCrawlerScheduler;
import com.smarttcm.service.NewsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * News Controller - 热点新闻管理控制器
 * 管理新闻记录，支持基础的 CRUD 操作
 */
@RestController
@RequestMapping("/news")
@Tag(name = "热点新闻管理", description = "新闻记录管理（管理员专用）")
@SecurityRequirement(name = "Bearer Authentication")
public class NewsController {

    private final NewsService newsService;
    private final NewsCrawlerScheduler newsCrawlerScheduler;

    public NewsController(NewsService newsService, NewsCrawlerScheduler newsCrawlerScheduler) {
        this.newsService = newsService;
        this.newsCrawlerScheduler = newsCrawlerScheduler;
    }

    /**
     * 获取新闻列表（支持按状态和分类筛选）
     * GET /api/v1/news
     */
    @Operation(summary = "获取新闻列表", description = "分页获取新闻列表，支持按状态（raw/used/expired）和分类筛选")
    @GetMapping
    public ResponseEntity<ApiResponse<NewsListResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<News> newsPage = newsService.getNewsPage(status, category, page, size);

        List<NewsResponse> newsList = newsService.toResponseList(newsPage.getContent());
        NewsListResponse response = NewsListResponse.of(
                newsList,
                newsPage.getTotalElements(),
                page,
                size
        );

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 获取单条新闻详情
     * GET /api/v1/news/{id}
     */
    @Operation(summary = "获取新闻详情", description = "根据 ID 获取单条新闻的详细信息")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<NewsResponse>> getById(@PathVariable Long id) {
        return newsService.getNewsById(id)
                .map(news -> ResponseEntity.ok(ApiResponse.success(newsService.toResponse(news))))
                .orElse(ResponseEntity.ok(ApiResponse.error("新闻不存在")));
    }

    /**
     * 新增新闻（管理员专用）
     * POST /api/v1/news
     */
    @Operation(summary = "新增新闻", description = "添加新的新闻记录（管理员专用）")
    @PostMapping
    @PreAuthorize("hasRole('SUPERUSER')")
    public ResponseEntity<ApiResponse<NewsResponse>> create(@Valid @RequestBody NewsCreateRequest request) {
        News news = new News();
        news.setTitle(request.getTitle());
        news.setContent(request.getContent());
        news.setSource(request.getSource());
        news.setUrl(request.getUrl());
        news.setCategory(request.getCategory());
        news.setStatus(News.STATUS_RAW);
        news.setFetchedAt(java.time.LocalDateTime.now());

        if (request.getPublishedAt() != null) {
            news.setPublishedAt(request.getPublishedAt());
        } else {
            news.setPublishedAt(news.getFetchedAt());
        }

        News saved = newsService.createNews(news);
        return ResponseEntity.ok(ApiResponse.success("新闻创建成功", newsService.toResponse(saved)));
    }

    /**
     * 更新新闻状态（管理员专用）
     * PUT /api/v1/news/{id}/status
     */
    @Operation(summary = "更新新闻状态", description = "更新新闻状态：raw（待使用）/ used（已使用）/ expired（已过期）")
    @PutMapping("/{id}/status")
    @PreAuthorize("hasRole('SUPERUSER')")
    public ResponseEntity<ApiResponse<NewsResponse>> updateStatus(
            @PathVariable Long id,
            @RequestBody NewsStatusRequest request) {
        if (request.getStatus() == null || request.getStatus().isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("status 不能为空"));
        }
        return newsService.updateStatus(id, request.getStatus())
                .map(news -> ResponseEntity.ok(ApiResponse.success("更新成功", newsService.toResponse(news))))
                .orElse(ResponseEntity.ok(ApiResponse.error("新闻不存在")));
    }

    /**
     * 删除新闻（管理员专用）
     * DELETE /api/v1/news/{id}
     */
    @Operation(summary = "删除新闻", description = "删除指定的新闻记录（管理员专用）")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPERUSER')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        if (newsService.deleteNews(id)) {
            return ResponseEntity.ok(ApiResponse.success("删除成功", null));
        }
        return ResponseEntity.ok(ApiResponse.error("新闻不存在"));
    }

    /**
     * 获取新闻统计信息
     * GET /api/v1/news/stats
     */
    @Operation(summary = "获取新闻统计", description = "获取新闻统计数据（管理员专用）")
    @GetMapping("/stats")
    @PreAuthorize("hasRole('SUPERUSER')")
    public ResponseEntity<ApiResponse<NewsStatsResponse>> stats() {
        NewsStatsResponse stats = NewsStatsResponse.builder()
                .total(newsService.countAll())
                .raw(newsService.countByStatus(News.STATUS_RAW))
                .used(newsService.countByStatus(News.STATUS_USED))
                .expired(newsService.countByStatus(News.STATUS_EXPIRED))
                .build();
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    /**
     * 手动触发新闻爬取（管理员专用）
     * POST /api/v1/news/fetch
     */
    @Operation(summary = "手动触发爬取", description = "立即从腾讯新闻爬取热点新闻（管理员专用）")
    @PostMapping("/fetch")
    @PreAuthorize("hasRole('SUPERUSER')")
    public ResponseEntity<ApiResponse<CrawlResponse>> fetch() {
        try {
            NewsCrawlerScheduler.CrawlResult result = newsCrawlerScheduler.manualCrawl();
            CrawlResponse response = new CrawlResponse(result.getNewCount(), result.getSkipCount());
            return ResponseEntity.ok(ApiResponse.success("爬取完成", response));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("爬取失败: " + e.getMessage()));
        }
    }

    /**
     * 爬取结果响应
     */
    public static class CrawlResponse {
        private int newCount;
        private int skipCount;

        public CrawlResponse() {}
        public CrawlResponse(int newCount, int skipCount) {
            this.newCount = newCount;
            this.skipCount = skipCount;
        }

        public int getNewCount() { return newCount; }
        public void setNewCount(int newCount) { this.newCount = newCount; }
        public int getSkipCount() { return skipCount; }
        public void setSkipCount(int skipCount) { this.skipCount = skipCount; }
    }
}