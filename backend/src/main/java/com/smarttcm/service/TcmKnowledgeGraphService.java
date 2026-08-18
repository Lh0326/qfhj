package com.smarttcm.service;

import com.smarttcm.dto.KnowledgeGraphLink;
import com.smarttcm.dto.KnowledgeGraphNode;
import com.smarttcm.dto.KnowledgeGraphResponse;
import com.smarttcm.dto.KnowledgeGraphSyncResponse;
import com.smarttcm.dto.QuestionResponse;
import com.smarttcm.entity.Question;
import com.smarttcm.repository.QuestionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "NEO4J_ENABLED", havingValue = "true", matchIfMissing = true)
public class TcmKnowledgeGraphService {

    private static final Logger log = LoggerFactory.getLogger(TcmKnowledgeGraphService.class);

    private final Neo4jClient neo4jClient;
    private final QuestionRepository questionRepository;

    // Schema 和种子数据只需初始化一次，缓存标记避免重复执行
    private volatile boolean schemaEnsured = false;
    private volatile boolean seedChecked = false;

    // 图谱统计缓存（每 5 分钟刷新一次）
    private volatile Map<String, Long> cachedStats = null;
    private volatile long statsCachedAt = 0;
    private static final long STATS_TTL_MS = 5 * 60 * 1000;

    public TcmKnowledgeGraphService(Neo4jClient neo4jClient, QuestionRepository questionRepository) {
        this.neo4jClient = neo4jClient;
        this.questionRepository = questionRepository;
    }

    public KnowledgeGraphSyncResponse syncRecentQuestions(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 2000));
        ensureSchema();
        List<Question> questions = questionRepository
                .findAll(PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "id")))
                .getContent();
        int synced = 0;
        for (Question q : questions) {
            syncQuestion(q);
            synced++;
        }
        return KnowledgeGraphSyncResponse.builder()
                .requested(safeLimit)
                .syncedQuestions(synced)
                .questionNodes(count("MATCH (q:Question) RETURN count(q)"))
                .entityNodes(count("MATCH (e:TcmEntity) RETURN count(e)"))
                .relationCount(count("MATCH ()-[r]->() RETURN count(r)"))
                .message("Neo4j 知识图谱同步完成")
                .build();
    }

    public void syncQuestionById(Long questionId) {
        questionRepository.findById(questionId).ifPresent(this::syncQuestionSafely);
    }

    public KnowledgeGraphResponse getQuestionGraph(Long questionId) {
        syncQuestionById(questionId);
        List<KnowledgeGraphNode> nodes = new ArrayList<>();
        List<KnowledgeGraphLink> links = new ArrayList<>();
        Set<String> seenNodes = new LinkedHashSet<>();
        Set<String> seenLinks = new LinkedHashSet<>();

        String cypher = """
                MATCH (q:Question {mysqlId: $questionId})-[r]-(e:TcmEntity)
                RETURN q.mysqlId AS qid, q.questionText AS questionText, e.name AS name, e.type AS type, e.description AS description, type(r) AS relation
                ORDER BY relation, name
                LIMIT 36
                """;
        Collection<Map<String, Object>> rows = neo4jClient.query(cypher)
                .bind(questionId).to("questionId")
                .fetch().all();

        String questionNodeId = "q:" + questionId;
        for (Map<String, Object> row : rows) {
            if (seenNodes.add(questionNodeId)) {
                nodes.add(KnowledgeGraphNode.builder()
                        .id(questionNodeId)
                        .label(shortText(asString(row.get("questionText")), 28))
                        .type("题目")
                        .questionId(questionId)
                        .count(1)
                        .description(asString(row.get("questionText")))
                        .build());
            }
            String entityName = asString(row.get("name"));
            if (entityName.isBlank()) continue;
            String entityNodeId = "e:" + entityName;
            if (seenNodes.add(entityNodeId)) {
                nodes.add(KnowledgeGraphNode.builder()
                        .id(entityNodeId)
                        .label(entityName)
                        .type(asString(row.get("type")))
                        .description(asString(row.get("description")))
                        .count(1)
                        .build());
            }
            String relation = prettyRelation(asString(row.get("relation")));
            String linkKey = questionNodeId + "->" + entityNodeId + ":" + relation;
            if (seenLinks.add(linkKey)) {
                links.add(KnowledgeGraphLink.builder()
                        .source(questionNodeId)
                        .target(entityNodeId)
                        .relation(relation)
                        .weight(1)
                        .build());
            }
        }

        List<QuestionResponse> questions = questionRepository.findById(questionId)
                .map(q -> List.of(toResponse(q)))
                .orElseGet(List::of);

        return KnowledgeGraphResponse.builder()
                .nodes(nodes)
                .links(links)
                .questions(questions)
                .stats(graphStats())
                .source("neo4j")
                .message(nodes.isEmpty() ? "该知识条目暂无图谱关系，可点击同步按钮生成" : "已从 Neo4j 读取关联知识图谱")
                .build();
    }

    public KnowledgeGraphResponse overview(String keyword, int limit) {
        int safeLimit = Math.max(6, Math.min(limit, 80));
        ensureSeedDataIfEmpty();
        String q = keyword == null ? "" : keyword.trim();

        // 双源合并查询：题库网络（Question 中心）+ 天池药品说明书网络（Drug 中心）。
        // qid/dtype 二选一：Question 行带 qid，Drug 行带 drugName，buildGraphFromRows 统一消化。
        Collection<Map<String, Object>> rows;
        if (q.isBlank()) {
            String cypher = """
                    MATCH (question:Question)-[r]->(entity:TcmEntity)
                    WITH question, null AS drugName, entity, type(r) AS relation, 0 AS prio
                    RETURN question.mysqlId AS qid, drugName, question.questionText AS questionText,
                           entity.name AS name, entity.type AS type, relation, entity.description AS description, prio
                    LIMIT $limit
                    UNION
                    MATCH (drug:Drug)-[r]->(entity:TcmEntity)
                    RETURN null AS qid, drug.name AS drugName, drug.name AS questionText,
                           entity.name AS name, entity.type AS type, type(r) AS relation,
                           entity.description AS description, 1 AS prio
                    LIMIT $limit
                    """;
            rows = neo4jClient.query(cypher).bind(safeLimit).to("limit").fetch().all();
        } else {
            String cypher = """
                    MATCH (question:Question)-[r]->(entity:TcmEntity)
                    WHERE toLower(question.questionText) CONTAINS toLower($keyword)
                       OR toLower(coalesce(question.knowledgePoint, '')) CONTAINS toLower($keyword)
                       OR toLower(entity.name) CONTAINS toLower($keyword)
                       OR toLower(coalesce(entity.description, '')) CONTAINS toLower($keyword)
                    WITH question, null AS drugName, entity, type(r) AS relation, 0 AS prio
                    RETURN question.mysqlId AS qid, drugName, question.questionText AS questionText,
                           entity.name AS name, entity.type AS type, relation, entity.description AS description, prio
                    LIMIT $limit
                    UNION
                    MATCH (drug:Drug)-[r]->(entity:TcmEntity)
                    WHERE toLower(drug.name) CONTAINS toLower($keyword)
                       OR toLower(entity.name) CONTAINS toLower($keyword)
                       OR toLower(coalesce(entity.description, '')) CONTAINS toLower($keyword)
                    RETURN null AS qid, drug.name AS drugName, drug.name AS questionText,
                           entity.name AS name, entity.type AS type, type(r) AS relation,
                           entity.description AS description, 1 AS prio
                    LIMIT $limit
                    """;
            rows = neo4jClient.query(cypher).bind(safeLimit).to("limit").bind(q).to("keyword").fetch().all();
        }

        return buildGraphFromRows(rows, safeLimit);
    }

    public List<Long> searchQuestionIds(String keyword, int limit) {
        if (keyword == null || keyword.isBlank()) return List.of();
        try {
            ensureSeedDataIfEmpty();
            String cypher = """
                MATCH (question:Question)
                OPTIONAL MATCH (question)-[:HAS_KNOWLEDGE|BELONGS_TO|HAS_CATEGORY|HAS_CONCEPT]->(entity:TcmEntity)
                WHERE toLower(question.questionText) CONTAINS toLower($keyword)
                   OR toLower(coalesce(question.knowledgePoint, '')) CONTAINS toLower($keyword)
                   OR toLower(coalesce(entity.name, '')) CONTAINS toLower($keyword)
                WITH question, count(entity) AS score
                RETURN question.mysqlId AS qid
                ORDER BY score DESC, question.mysqlId DESC
                LIMIT $limit
                """;
            return neo4jClient.query(cypher)
                    .bind(keyword.trim()).to("keyword")
                    .bind(Math.max(1, Math.min(limit, 100))).to("limit")
                    .fetch().all().stream()
                    .map(row -> asLong(row.get("qid")))
                    .filter(id -> id != null && id > 0)
                    .collect(Collectors.toList());
        } catch (Exception ex) {
            log.warn("Neo4j search failed, fallback to MySQL search: {}", ex.getMessage());
            return List.of();
        }
    }

    private KnowledgeGraphResponse buildGraphFromRows(Collection<Map<String, Object>> rows, int questionLimit) {
        Map<String, KnowledgeGraphNode> nodeMap = new LinkedHashMap<>();
        Map<String, KnowledgeGraphLink> linkMap = new LinkedHashMap<>();
        Set<Long> questionIds = new LinkedHashSet<>();

        for (Map<String, Object> row : rows) {
            Long qid = asLong(row.get("qid"));
            String drugName = asString(row.get("drugName"));
            String questionText = asString(row.get("questionText"));
            String entityName = asString(row.get("name"));
            // 中心节点：Question 行（qid 非空）或 Drug 行（drugName 非空）；两者皆空则跳过
            if (entityName.isBlank() || (qid == null && drugName.isBlank())) continue;

            String cNode;   // 中心节点 id
            if (qid != null) {
                questionIds.add(qid);
                cNode = "q:" + qid;
                nodeMap.putIfAbsent(cNode, KnowledgeGraphNode.builder()
                        .id(cNode).label(shortText(questionText, 22)).type("题目").questionId(qid).count(1).description(questionText).build());
            } else {
                cNode = "d:" + drugName;
                nodeMap.putIfAbsent(cNode, KnowledgeGraphNode.builder()
                        .id(cNode).label(drugName).type("药品").count(1)
                        .description("药品 · 天池中药说明书数据集").build());
            }
            String eNode = "e:" + entityName;
            nodeMap.putIfAbsent(eNode, KnowledgeGraphNode.builder()
                    .id(eNode).label(entityName).type(asString(row.get("type"))).count(1).description(asString(row.get("description"))).build());
            String relation = prettyRelation(asString(row.get("relation")));
            String linkKey = cNode + "->" + eNode + ":" + relation;
            linkMap.putIfAbsent(linkKey, KnowledgeGraphLink.builder().source(cNode).target(eNode).relation(relation).weight(1).build());
        }

        List<QuestionResponse> questions = questionRepository.findAllById(questionIds).stream()
                .map(this::toResponse)
                .limit(questionLimit)
                .collect(Collectors.toList());
        return KnowledgeGraphResponse.builder()
                .nodes(new ArrayList<>(nodeMap.values()))
                .links(new ArrayList<>(linkMap.values()))
                .questions(questions)
                .stats(graphStats())
                .source("neo4j")
                .message(nodeMap.isEmpty() ? "Neo4j 暂无匹配关系，请先同步知识图谱" : "已从 Neo4j 读取知识关联网络")
                .build();
    }

    private void ensureSeedDataIfEmpty() {
        if (seedChecked) return;
        try {
            ensureSchema();
            if (count("MATCH (q:Question) RETURN count(q)") == 0) {
                syncRecentQuestions(120);
            }
            seedChecked = true;
        } catch (Exception ex) {
            log.warn("Neo4j seed check failed: {}", ex.getMessage());
        }
    }

    private void ensureSchema() {
        if (schemaEnsured) return;
        neo4jClient.query("CREATE CONSTRAINT question_mysql_id IF NOT EXISTS FOR (q:Question) REQUIRE q.mysqlId IS UNIQUE").run();
        neo4jClient.query("CREATE CONSTRAINT tcm_entity_name IF NOT EXISTS FOR (e:TcmEntity) REQUIRE e.name IS UNIQUE").run();
        schemaEnsured = true;
    }

    private void syncQuestionSafely(Question q) {
        try {
            syncQuestion(q);
        } catch (Exception ex) {
            log.warn("Sync question {} to Neo4j failed: {}", q.getId(), ex.getMessage());
        }
    }

    private void syncQuestion(Question q) {
        if (q == null || q.getId() == null) return;
        ensureSchema();
        neo4jClient.query("""
                MERGE (question:Question {mysqlId: $mysqlId})
                SET question.questionText = $questionText,
                    question.questionType = $questionType,
                    question.knowledgePoint = $knowledgePoint,
                    question.primaryProject = $primaryProject,
                    question.secondaryProject = $secondaryProject,
                    question.contentCategory = $contentCategory,
                    question.updatedAt = datetime()
                """)
                .bind(q.getId()).to("mysqlId")
                .bind(nullToEmpty(q.getQuestion())).to("questionText")
                .bind(nullToEmpty(q.getQuestionType())).to("questionType")
                .bind(nullToEmpty(q.getKnowledgePoint())).to("knowledgePoint")
                .bind(nullToEmpty(q.getPrimaryProject())).to("primaryProject")
                .bind(nullToEmpty(q.getSecondaryProject())).to("secondaryProject")
                .bind(nullToEmpty(q.getContentCategory())).to("contentCategory")
                .run();

        connectTerm(q, q.getQuestionType(), "题型", "HAS_CATEGORY");
        connectTerm(q, q.getQuestionCategory(), "分类", "HAS_CATEGORY");
        connectTerm(q, q.getContentCategory(), "分类", "BELONGS_TO");
        connectTerm(q, q.getPrimaryProject(), "分类", "BELONGS_TO");
        connectTerm(q, q.getSecondaryProject(), "分类", "BELONGS_TO");
        for (String term : TcmKnowledgeGraphTextUtils.extractTerms(
                q.getKnowledgePoint(), q.getCoreConnotation(), q.getMainFocus(), q.getCulturalPoint())) {
            connectTerm(q, term, TcmKnowledgeGraphTextUtils.classifyTerm(term), "HAS_KNOWLEDGE");
        }
    }

    private void connectTerm(Question q, String rawTerm, String fallbackType, String relation) {
        if (rawTerm == null || rawTerm.isBlank()) return;
        for (String term : TcmKnowledgeGraphTextUtils.extractTerms(rawTerm)) {
            String type = fallbackType == null || fallbackType.isBlank() ? TcmKnowledgeGraphTextUtils.classifyTerm(term) : fallbackType;
            neo4jClient.query("""
                    MATCH (question:Question {mysqlId: $mysqlId})
                    MERGE (entity:TcmEntity {name: $name})
                    SET entity.type = coalesce(entity.type, $type),
                        entity.description = $description
                    MERGE (question)-[r:%s]->(entity)
                    SET r.updatedAt = datetime()
                    """.formatted(relation))
                    .bind(q.getId()).to("mysqlId")
                    .bind(term).to("name")
                    .bind(type).to("type")
                    .bind(type + " · 来源于千方慧鉴中医知识库").to("description")
                    .run();
        }
    }

    private Map<String, Long> graphStats() {
        long now = System.currentTimeMillis();
        if (cachedStats != null && (now - statsCachedAt) < STATS_TTL_MS) {
            return cachedStats;
        }
        Map<String, Long> stats = new LinkedHashMap<>();
        stats.put("questions", count("MATCH (q:Question) RETURN count(q)"));
        stats.put("entities", count("MATCH (e:TcmEntity) RETURN count(e)"));
        stats.put("relations", count("MATCH ()-[r]->() RETURN count(r)"));
        cachedStats = stats;
        statsCachedAt = now;
        return stats;
    }

    private long count(String cypher) {
        try {
            return neo4jClient.query(cypher).fetch().one()
                    .map(row -> row.values().stream().findFirst().map(TcmKnowledgeGraphService::asLong).orElse(0L))
                    .orElse(0L);
        } catch (Exception ex) {
            log.warn("Neo4j count failed: {}", ex.getMessage());
            return 0L;
        }
    }

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

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static Long asLong(Object value) {
        if (value instanceof Number number) return number.longValue();
        try {
            return value == null ? null : Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String shortText(String value, int max) {
        if (value == null || value.isBlank()) return "知识条目";
        String cleaned = value.replaceAll("\\s+", "").trim();
        return cleaned.length() <= max ? cleaned : cleaned.substring(0, max) + "…";
    }

    private static String prettyRelation(String relation) {
        return switch (relation) {
            case "HAS_KNOWLEDGE" -> "知识点";
            case "BELONGS_TO" -> "归属";
            case "HAS_CATEGORY" -> "分类";
            case "HAS_CONCEPT" -> "概念";
            // 天池药品说明书网络关系
            case "HAS_INGREDIENT" -> "包含成分";
            case "HAS_EFFICACY" -> "具有功效";
            case "TREATS_SYMPTOM" -> "治疗症状";
            case "TREATS_DISEASE" -> "治疗疾病";
            case "TREATS_SYNDROME" -> "治疗证候";
            case "FOR_POPULATION" -> "适用人群";
            case "HAS_DOSAGE_FORM" -> "剂型";
            case "HAS_FLAVOR_NATURE" -> "性味";
            case "AVOID_FOOD" -> "忌食";
            case "AVOID_FOOD_GROUP" -> "忌食类";
            case "CO_OCCURS_WITH" -> "共现";
            default -> relation == null || relation.isBlank() ? "关联" : relation;
        };
    }
}
