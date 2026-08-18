package com.smarttcm.scheduler;

import com.smarttcm.entity.QuestionCategoryCache;
import com.smarttcm.repository.QuestionCategoryCacheRepository;
import com.smarttcm.repository.QuestionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Category Cache Scheduler - 分类缓存定时刷新
 * 定时从 questions 表中聚合分类选项，写入缓存表
 */
@Component
public class CategoryCacheScheduler {

    private static final Logger log = LoggerFactory.getLogger(CategoryCacheScheduler.class);
    private static final String CACHE_KEY = "default";

    private final QuestionCategoryCacheRepository cacheRepository;
    private final QuestionRepository questionRepository;

    public CategoryCacheScheduler(QuestionCategoryCacheRepository cacheRepository,
                                   QuestionRepository questionRepository) {
        this.cacheRepository = cacheRepository;
        this.questionRepository = questionRepository;
    }

    /**
     * 每小时刷新一次缓存
     */
    @Scheduled(fixedRate = 3600000)
    public void refreshCache() {
        try {
            List<String> questionCategories = questionRepository.findDistinctQuestionCategories();
            List<String> contentCategories = questionRepository.findDistinctContentCategories();
            List<String> questionTypes = questionRepository.findDistinctQuestionTypes();
            List<String> primaryProjects = questionRepository.findDistinctPrimaryProjects();
            List<String> secondaryProjects = questionRepository.findDistinctSecondaryProjects();
            List<String> competitions = questionRepository.findDistinctCompetitions();
            List<String> yearStages = questionRepository.findDistinctYearStages();
            long totalQuestions = questionRepository.count();

            QuestionCategoryCache cache = cacheRepository.findById(CACHE_KEY)
                    .orElse(new QuestionCategoryCache());
            cache.setCacheKey(CACHE_KEY);
            cache.setTotalQuestions(totalQuestions);
            cache.setQuestionCategories(String.join(",", questionCategories));
            cache.setContentCategories(String.join(",", contentCategories));
            cache.setQuestionTypes(String.join(",", questionTypes));
            cache.setPrimaryProjects(String.join(",", primaryProjects));
            cache.setSecondaryProjects(String.join(",", secondaryProjects));
            cache.setCompetitions(String.join(",", competitions));
            cache.setYearStages(String.join(",", yearStages));

            cacheRepository.save(cache);
            log.info("分类缓存刷新完成: {} 条题目, {} 个大类, {} 个子类",
                    totalQuestions, questionCategories.size(), contentCategories.size());
        } catch (Exception e) {
            log.error("分类缓存刷新失败: {}", e.getMessage());
        }
    }
}
