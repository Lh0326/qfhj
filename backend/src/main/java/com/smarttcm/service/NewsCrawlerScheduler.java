package com.smarttcm.service;

import com.smarttcm.config.AppConfig;
import com.smarttcm.entity.News;
import com.smarttcm.repository.NewsRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * NewsCrawlerScheduler - 腾讯新闻自动爬取定时任务
 *
 * 通过 tencent-news-cli 自动爬取腾讯新闻热点榜，
 * 并存入 news 数据库表，状态默认为 raw（待使用）。
 *
 * 支持：
 * - 定时爬取（默认每6小时）
 * - 应用启动时自动执行一次
 * - 手动触发爬取
 */
@Service
public class NewsCrawlerScheduler {

    private static final Logger log = LoggerFactory.getLogger(NewsCrawlerScheduler.class);

    private final AppConfig appConfig;
    private final NewsRepository newsRepository;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public NewsCrawlerScheduler(AppConfig appConfig, NewsRepository newsRepository, ObjectMapper objectMapper) {
        this.appConfig = appConfig;
        this.newsRepository = newsRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * 定时爬取任务 - 每6小时执行一次
     * 可通过 application.yml 中的 app.news.fetch-interval-hours 配置间隔
     */
    @Scheduled(cron = "0 0 */6 * * ?")
    @Transactional
    public void scheduledCrawl() {
        log.info("开始执行定时新闻爬取任务...");
        try {
            CrawlResult result = crawlHotNews();
            log.info("定时爬取完成: 新增={}, 跳过(已存在)={}", result.newCount, result.skipCount);
        } catch (Exception e) {
            log.error("定时爬取任务失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 应用启动时立即执行一次
     */
    @Scheduled(initialDelay = 5000, fixedDelay = Long.MAX_VALUE)
    public void initialCrawl() {
        log.info("应用启动，执行初始新闻爬取...");
        try {
            CrawlResult result = crawlHotNews();
            log.info("初始爬取完成: 新增={}, 跳过(已存在)={}", result.newCount, result.skipCount);
        } catch (Exception e) {
            log.error("初始爬取失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 手动触发爬取
     * @return 爬取结果统计
     */
    @Transactional
    public CrawlResult manualCrawl() {
        log.info("手动触发新闻爬取...");
        try {
            return crawlHotNews();
        } catch (Exception e) {
            log.error("手动爬取失败: {}", e.getMessage(), e);
            throw new RuntimeException("新闻爬取失败: " + e.getMessage(), e);
        }
    }

    /**
     * 执行热点新闻爬取
     */
    private CrawlResult crawlHotNews() throws Exception {
        String disableCrawler = System.getenv("QFHJ_DISABLE_NEWS_CRAWLER");
        if ("1".equals(disableCrawler) || "true".equalsIgnoreCase(disableCrawler)) {
            log.info("新闻 CLI 爬取已在本地可移动模式下禁用，跳过自动爬取");
            return new CrawlResult(0, 0);
        }

        String cliPath = appConfig.getNews().getCliPath();
        int limit = appConfig.getNews().getHotLimit();

        if (cliPath == null || cliPath.isBlank()) {
            log.warn("未配置 tencent-news-cli 路径，跳过爬取");
            return new CrawlResult(0, 0);
        }

        // 转换为绝对路径
        File cliFile = new File(cliPath);
        if (!cliFile.isAbsolute()) {
            cliPath = cliFile.getAbsolutePath();
            log.info("CLI 路径转换为绝对路径: {}", cliPath);
        }

        // 验证 CLI 文件是否存在
        if (!new File(cliPath).exists()) {
            log.error("CLI 文件不存在: {}", cliPath);
            throw new RuntimeException("CLI 文件不存在: " + cliPath);
        }

        // 获取已存在的 URL 列表（用于去重）
        Set<String> existingUrls = new HashSet<>(newsRepository.findAllUrls());

        // 执行 CLI 命令
        ProcessBuilder pb = new ProcessBuilder(cliPath, "hot");
        String tenantToken = System.getenv("TENANT_ACCESS_TOKEN_SECRET");
        if (tenantToken != null && !tenantToken.isBlank()) {
            pb.environment().put("TENANT_ACCESS_TOKEN_SECRET", tenantToken);
        }
        pb.redirectErrorStream(true);

        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }

        int exitCode = process.waitFor();
        if (exitCode != 0) {
            log.error("tencent-news-cli 执行失败，退出码: {}", exitCode);
            throw new RuntimeException("CLI 执行失败，退出码: " + exitCode);
        }

        // 解析输出
        String cliOutput = output.toString();
        log.debug("CLI 输出长度: {} 字符", cliOutput.length());

        // 解析新闻条目
        int newCount = 0;
        int skipCount = 0;

        NewsParser parser = new NewsParser();
        for (News news : parser.parseHotNews(cliOutput)) {
            // 去重检查
            if (news.getUrl() != null && existingUrls.contains(news.getUrl())) {
                skipCount++;
                continue;
            }

            news.setStatus(News.STATUS_RAW);
            news.setFetchedAt(LocalDateTime.now());
            news.setCategory("热点");

            // 保存原始 JSON（可选，用于调试）
            news.setRawJson(objectMapper.writeValueAsString(news));

            newsRepository.save(news);
            existingUrls.add(news.getUrl()); // 防止同批次重复
            newCount++;

            log.debug("保存新闻: {}", news.getTitle());
        }

        log.info("热点新闻爬取完成: 新增 {} 条, 跳过 {} 条", newCount, skipCount);
        return new CrawlResult(newCount, skipCount);
    }

    /**
     * 爬取结果统计
     */
    public static class CrawlResult {
        private final int newCount;
        private final int skipCount;

        public CrawlResult(int newCount, int skipCount) {
            this.newCount = newCount;
            this.skipCount = skipCount;
        }

        public int getNewCount() { return newCount; }
        public int getSkipCount() { return skipCount; }

        @Override
        public String toString() {
            return String.format("CrawlResult{新增=%d, 跳过=%d}", newCount, skipCount);
        }
    }

    /**
     * 新闻解析器 - 从 CLI 输出中解析新闻数据
     */
    private static class NewsParser {

        // 匹配标题行: "1. 标题：xxx"
        private static final Pattern TITLE_PATTERN = Pattern.compile("^\\d+\\.\\s*标题[：:](.+)$");
        // 匹配摘要行: "摘要: xxx"
        private static final Pattern SUMMARY_PATTERN = Pattern.compile("^\\s*摘要[：:](.+)$");
        // 匹配来源行: "来源: xxx"
        private static final Pattern SOURCE_PATTERN = Pattern.compile("^\\s*来源[：:](.+)$");
        // 匹配发布时间行: "发布时间: xxx"
        private static final Pattern TIME_PATTERN = Pattern.compile("^\\s*发布时间[：:](.+)$");
        // 匹配链接行: "链接: xxx"
        private static final Pattern LINK_PATTERN = Pattern.compile("^\\s*链接[：:](.+)$");

        public java.util.List<News> parseHotNews(String output) {
            java.util.List<News> newsList = new java.util.ArrayList<>();
            String[] lines = output.split("\n");

            News currentNews = null;
            StringBuilder summaryBuilder = new StringBuilder();

            for (String line : lines) {
                Matcher titleMatcher = TITLE_PATTERN.matcher(line.trim());
                if (titleMatcher.matches()) {
                    // 保存上一个新闻
                    if (currentNews != null) {
                        currentNews.setContent(summaryBuilder.toString().trim());
                        newsList.add(currentNews);
                    }

                    // 开始新新闻
                    currentNews = new News();
                    currentNews.setTitle(titleMatcher.group(1).trim());
                    summaryBuilder = new StringBuilder();
                    continue;
                }

                if (currentNews == null) continue;

                Matcher summaryMatcher = SUMMARY_PATTERN.matcher(line);
                if (summaryMatcher.matches()) {
                    summaryBuilder.append(summaryMatcher.group(1).trim());
                    continue;
                }

                Matcher sourceMatcher = SOURCE_PATTERN.matcher(line);
                if (sourceMatcher.matches()) {
                    currentNews.setSource(sourceMatcher.group(1).trim());
                    continue;
                }

                Matcher timeMatcher = TIME_PATTERN.matcher(line);
                if (timeMatcher.matches()) {
                    try {
                        LocalDateTime publishedAt = LocalDateTime.parse(
                                timeMatcher.group(1).trim(), DATE_FORMATTER);
                        currentNews.setPublishedAt(publishedAt);
                    } catch (Exception e) {
                        log.debug("解析发布时间失败: {}", line);
                    }
                    continue;
                }

                Matcher linkMatcher = LINK_PATTERN.matcher(line);
                if (linkMatcher.matches()) {
                    currentNews.setUrl(linkMatcher.group(1).trim());
                    continue;
                }
            }

            // 保存最后一个新闻
            if (currentNews != null) {
                currentNews.setContent(summaryBuilder.toString().trim());
                newsList.add(currentNews);
            }

            return newsList;
        }
    }
}
