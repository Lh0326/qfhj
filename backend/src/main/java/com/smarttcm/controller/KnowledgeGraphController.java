package com.smarttcm.controller;

import com.smarttcm.dto.ApiResponse;
import com.smarttcm.dto.KnowledgeGraphResponse;
import com.smarttcm.dto.KnowledgeGraphSyncResponse;
import com.smarttcm.service.TcmKnowledgeGraphService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/questions/graph")
@ConditionalOnProperty(name = "NEO4J_ENABLED", havingValue = "true", matchIfMissing = true)
@Tag(name = "Neo4j 中医知识图谱", description = "以 Neo4j 为主导的知识库关系查询、同步和可视化接口")
public class KnowledgeGraphController {

    private final TcmKnowledgeGraphService graphService;

    public KnowledgeGraphController(TcmKnowledgeGraphService graphService) {
        this.graphService = graphService;
    }

    @Operation(summary = "同步知识库到 Neo4j", description = "从 MySQL questions 表抽取中医知识条目、分类、知识点，写入 Neo4j 图数据库")
    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<KnowledgeGraphSyncResponse>> sync(
            @Parameter(description = "同步最近多少条知识，默认 500，最大 2000") @RequestParam(defaultValue = "500") int limit) {
        KnowledgeGraphSyncResponse data = graphService.syncRecentQuestions(limit);
        return ResponseEntity.ok(ApiResponse.success("Neo4j 知识图谱同步完成", data));
    }

    @Operation(summary = "知识图谱概览", description = "从 Neo4j 查询知识条目与中医概念、分类、功效之间的关系网络")
    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<KnowledgeGraphResponse>> overview(
            @Parameter(description = "关键词，可搜索题干/知识点/实体") @RequestParam(required = false) String q,
            @Parameter(description = "图谱边数量限制") @RequestParam(defaultValue = "36") int limit) {
        KnowledgeGraphResponse data = graphService.overview(q, limit);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    @Operation(summary = "单条知识图谱", description = "根据知识条目 ID 查询 Neo4j 中关联的概念、分类、功效等节点")
    @GetMapping("/question/{questionId}")
    public ResponseEntity<ApiResponse<KnowledgeGraphResponse>> questionGraph(
            @Parameter(description = "MySQL questions.id") @PathVariable Long questionId) {
        KnowledgeGraphResponse data = graphService.getQuestionGraph(questionId);
        return ResponseEntity.ok(ApiResponse.success(data));
    }
}
