package com.smarttcm.service;

import com.smarttcm.dto.CategoryListResponse;
import com.smarttcm.dto.QuestionListResponse;
import com.smarttcm.dto.QuestionResponse;
import com.smarttcm.dto.QuestionStatsResponse;
import com.smarttcm.entity.Question;
import com.smarttcm.entity.QuestionCategoryCache;
import com.smarttcm.repository.QuestionCategoryCacheRepository;
import com.smarttcm.repository.QuestionRepository;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Question Service - 题目业务逻辑层
 * 处理题目查询、分页、搜索、分类等业务逻辑
 */
@Service
public class QuestionService {

    private static final Logger log = LoggerFactory.getLogger(QuestionService.class);

    private final QuestionRepository questionRepository;
    private final QuestionCategoryCacheRepository cacheRepository;

    @Autowired(required = false)
    private TcmKnowledgeGraphService knowledgeGraphService;

    public QuestionService(QuestionRepository questionRepository,
                            QuestionCategoryCacheRepository cacheRepository) {
        this.questionRepository = questionRepository;
        this.cacheRepository = cacheRepository;
    }

    /**
     * 获取题目列表（分页 + 筛选）
     */
    public QuestionListResponse getQuestions(int page, int pageSize,
                                             String competition, String yearStage,
                                             String questionType, String questionCategory,
                                             String contentCategory,
                                             String primaryProject, String secondaryProject,
                                             String searchText) {
        // 构建 Specification 动态查询
        Specification<Question> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (competition != null && !competition.isEmpty()) {
                predicates.add(cb.equal(root.get("competition"), competition));
            }
            if (yearStage != null && !yearStage.isEmpty()) {
                predicates.add(cb.equal(root.get("yearStage"), yearStage));
            }
            if (questionType != null && !questionType.isEmpty()) {
                predicates.add(cb.equal(root.get("questionType"), questionType));
            }
            if (questionCategory != null && !questionCategory.isEmpty()) {
                predicates.add(cb.equal(root.get("questionCategory"), questionCategory));
            }
            if (contentCategory != null && !contentCategory.isEmpty()) {
                predicates.add(cb.equal(root.get("contentCategory"), contentCategory));
            }
            if (primaryProject != null && !primaryProject.isEmpty()) {
                predicates.add(cb.equal(root.get("primaryProject"), primaryProject));
            }
            if (secondaryProject != null && !secondaryProject.isEmpty()) {
                predicates.add(cb.equal(root.get("secondaryProject"), secondaryProject));
            }
            if (searchText != null && !searchText.isEmpty()) {
                String pattern = "%" + searchText.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("question")), pattern),
                        cb.like(cb.lower(root.get("answer")), pattern),
                        cb.like(cb.lower(root.get("knowledgePoint")), pattern),
                        cb.like(cb.lower(root.get("options")), pattern)
                ));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Pageable pageable = PageRequest.of(page, pageSize, Sort.by(Sort.Direction.DESC, "id"));
        Page<Question> result = questionRepository.findAll(spec, pageable);

        List<QuestionResponse> questions = result.getContent().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return QuestionListResponse.builder()
                .questions(questions)
                .total(result.getTotalElements())
                .page(page)
                .pageSize(pageSize)
                .totalPages(result.getTotalPages())
                .build();
    }

    /**
     * 搜索题目
     */
    public QuestionListResponse searchQuestions(String keyword, int page, int pageSize) {
        if (knowledgeGraphService == null) {
            log.warn("知识图谱服务未启用（Neo4j未连接），搜索仅使用数据库模糊匹配");
            return getQuestions(page, pageSize, null, null, null, null, null, null, null, keyword);
        }
        List<Long> graphIds = knowledgeGraphService.searchQuestionIds(keyword, Math.max(pageSize, (page + 1) * pageSize));
        if (!graphIds.isEmpty()) {
            int from = Math.min(page * pageSize, graphIds.size());
            int to = Math.min(from + pageSize, graphIds.size());
            List<Long> pageIds = graphIds.subList(from, to);
            Map<Long, Question> byId = questionRepository.findAllById(pageIds).stream()
                    .collect(Collectors.toMap(Question::getId, q -> q));
            List<QuestionResponse> questions = pageIds.stream()
                    .map(byId::get)
                    .filter(Objects::nonNull)
                    .map(this::toResponse)
                    .collect(Collectors.toList());
            return QuestionListResponse.builder()
                    .questions(questions)
                    .total(graphIds.size())
                    .page(page)
                    .pageSize(pageSize)
                    .totalPages((int) Math.ceil(graphIds.size() / (double) pageSize))
                    .build();
        }

        Pageable pageable = PageRequest.of(page, pageSize, Sort.by(Sort.Direction.DESC, "id"));
        Page<Question> result = questionRepository.searchByKeyword(keyword, pageable);

        List<QuestionResponse> questions = result.getContent().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return QuestionListResponse.builder()
                .questions(questions)
                .total(result.getTotalElements())
                .page(page)
                .pageSize(pageSize)
                .totalPages(result.getTotalPages())
                .build();
    }

    /**
     * 获取题目详情
     */
    public QuestionResponse getQuestionDetail(Long id) {
        Question question = questionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("题目不存在: " + id));
        if (knowledgeGraphService != null) {
            knowledgeGraphService.syncQuestionById(id);
        }
        return toResponse(question);
    }

    /**
     * 获取分类选项列表
     * 优先从缓存表读取，缓存不存在则实时查询
     */
    public CategoryListResponse getCategoryOptions() {
        // 尝试从缓存读取
        Optional<QuestionCategoryCache> cacheOpt = cacheRepository.findById("default");

        if (cacheOpt.isPresent()) {
            QuestionCategoryCache cache = cacheOpt.get();
            return CategoryListResponse.builder()
                    .competitions(splitToList(cache.getCompetitions()))
                    .yearStages(splitToList(cache.getYearStages()))
                    .questionTypes(splitToList(cache.getQuestionTypes()))
                    .questionCategories(splitToList(cache.getQuestionCategories()))
                    .contentCategories(splitToList(cache.getContentCategories()))
                    .primaryProjects(splitToList(cache.getPrimaryProjects()))
                    .secondaryProjects(splitToList(cache.getSecondaryProjects()))
                    .build();
        }

        // 缓存不存在，实时查询
        return CategoryListResponse.builder()
                .competitions(questionRepository.findDistinctCompetitions())
                .yearStages(questionRepository.findDistinctYearStages())
                .questionTypes(questionRepository.findDistinctQuestionTypes())
                .questionCategories(questionRepository.findDistinctQuestionCategories())
                .contentCategories(questionRepository.findDistinctContentCategories())
                .primaryProjects(questionRepository.findDistinctPrimaryProjects())
                .secondaryProjects(questionRepository.findDistinctSecondaryProjects())
                .build();
    }

    /**
     * 获取题库统计信息
     */
    public QuestionStatsResponse getStats() {
        long total = questionRepository.count();
        List<Object[]> categoryCounts = questionRepository.countByQuestionCategory();

        Map<String, Long> categories = new LinkedHashMap<>();
        for (Object[] row : categoryCounts) {
            String cat = (String) row[0];
            Long count = (Long) row[1];
            categories.put(cat, count);
        }

        return QuestionStatsResponse.builder()
                .totalQuestions(total)
                .categories(categories)
                .build();
    }

    /**
     * 将实体转换为响应 DTO
     */
    private QuestionResponse toResponse(Question q) {
        return QuestionResponse.builder()
                .id(q.getId())
                .competition(q.getCompetition())
                .yearStage(q.getYearStage())
                .questionType(q.getQuestionType())
                .questionCategory(q.getQuestionCategory())
                .contentCategory(q.getContentCategory())
                .question(q.getQuestion())
                .options(q.getOptions())
                .answer(q.getAnswer())
                .answerImageUrl(q.getAnswerImageUrl())
                .questionImageUrl(q.getQuestionImageUrl())
                .mediaUrl(q.getMediaUrl())
                .answerOnly(q.getAnswerOnly())
                .knowledgePoint(q.getKnowledgePoint())
                .primaryProject(q.getPrimaryProject())
                .secondaryProject(q.getSecondaryProject())
                .culturalPoint(q.getCulturalPoint())
                .fourStageCognition(q.getFourStageCognition())
                .bloomCognitionLevel(q.getBloomCognitionLevel())
                .coreConnotation(q.getCoreConnotation())
                .whyQuestion(q.getWhyQuestion())
                .mainFocus(q.getMainFocus())
                .textLevel(q.getTextLevel())
                .createdAt(q.getCreatedAt() != null ? q.getCreatedAt().toString() : null)
                .updatedAt(q.getUpdatedAt() != null ? q.getUpdatedAt().toString() : null)
                .build();
    }

    /**
     * 将逗号分隔的字符串拆分为列表
     */
    private List<String> splitToList(String str) {
        if (str == null || str.isEmpty()) return Collections.emptyList();
        return Arrays.stream(str.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }
}
