package com.smarttcm.controller;

import com.smarttcm.service.DocumentProcessorService;
import com.smarttcm.service.QuestionVectorService;
import com.smarttcm.service.RagService;
import com.smarttcm.service.VectorStoreService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/rag")
@Tag(name = "RAG", description = "检索增强生成相关接口")
@CrossOrigin(origins = "*")
public class RagController {

    private static final Logger logger = LoggerFactory.getLogger(RagController.class);

    private final RagService ragService;
    private final VectorStoreService vectorStoreService;
    private final DocumentProcessorService documentProcessorService;
    private final QuestionVectorService questionVectorService;

    public RagController(RagService ragService,
                         VectorStoreService vectorStoreService,
                         DocumentProcessorService documentProcessorService,
                         QuestionVectorService questionVectorService) {
        this.ragService = ragService;
        this.vectorStoreService = vectorStoreService;
        this.documentProcessorService = documentProcessorService;
        this.questionVectorService = questionVectorService;
    }

    @PostMapping("/query")
    @Operation(summary = "RAG 查询", description = "基于检索增强生成回答用户问题")
    public ResponseEntity<Map<String, Object>> query(
            @Parameter(description = "用户问题")
            @RequestParam String question,
            @Parameter(description = "返回结果数量")
            @RequestParam(defaultValue = "5") int topK) {

        try {
            List<VectorStoreService.SearchResult> results =
                vectorStoreService.search(question, topK);

            if (results.isEmpty()) {
                Map<String, Object> emptyResponse = new HashMap<>();
                emptyResponse.put("success", true);
                emptyResponse.put("answer", "抱歉，数据库中没有找到相关信息。请先上传相关文档。");
                emptyResponse.put("results", List.of());
                return ResponseEntity.ok(emptyResponse);
            }

            String answer = ragService.query(question, topK);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("answer", answer);
            response.put("results", results);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("RAG 查询失败: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    @PostMapping("/retrieve")
    @Operation(summary = "仅检索", description = "只返回相关文档，不生成回答")
    public ResponseEntity<Map<String, Object>> retrieve(
            @Parameter(description = "查询内容")
            @RequestParam String query,
            @Parameter(description = "返回结果数量")
            @RequestParam(defaultValue = "5") int topK) {

        try {
            List<VectorStoreService.SearchResult> results =
                vectorStoreService.search(query, topK);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("query", query);
            response.put("results", results);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("检索失败: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    @PostMapping("/document")
    @Operation(summary = "添加文档（文本）", description = "添加纯文本内容到向量数据库")
    public ResponseEntity<Map<String, Object>> addDocument(
            @Parameter(description = "文档内容")
            @RequestParam String content,
            @Parameter(description = "文档标题（可选）")
            @RequestParam(required = false) String title) {

        try {
            String ids = ragService.addDocument(content);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "文档添加成功");
            response.put("documentIds", ids);
            response.put("totalDocuments", ragService.getDocumentCount());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("添加文档失败: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    @PostMapping("/document/upload")
    @Operation(summary = "上传文档文件", description = "上传文件并提取内容添加到向量数据库")
    public ResponseEntity<Map<String, Object>> uploadDocument(
            @Parameter(description = "支持 .txt, .md, .html 格式")
            @RequestParam("file") MultipartFile file) {

        try {
            String content = documentProcessorService.extractTextFromFile(file);
            String ids = ragService.addDocumentFromFile(file.getOriginalFilename(), content);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "文件上传并添加成功");
            response.put("filename", file.getOriginalFilename());
            response.put("documentIds", ids);
            response.put("totalDocuments", ragService.getDocumentCount());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("上传文档失败: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    @DeleteMapping("/document/{id}")
    @Operation(summary = "删除文档", description = "根据文档ID删除指定文档")
    public ResponseEntity<Map<String, Object>> deleteDocument(
            @Parameter(description = "文档ID")
            @PathVariable String id) {

        try {
            boolean deleted = ragService.deleteDocument(id);

            Map<String, Object> response = new HashMap<>();
            response.put("success", deleted);
            response.put("documentId", id);
            response.put("totalDocuments", ragService.getDocumentCount());

            if (deleted) {
                response.put("message", "文档删除成功");
            } else {
                response.put("message", "文档不存在或删除失败");
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("删除文档失败: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    @DeleteMapping("/document")
    @Operation(summary = "清空所有文档", description = "清空向量数据库中的所有文档")
    public ResponseEntity<Map<String, Object>> clearAllDocuments() {
        try {
            ragService.clearAllDocuments();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "所有文档已清空");
            response.put("totalDocuments", 0);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("清空文档失败: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    @GetMapping("/stats")
    @Operation(summary = "获取统计信息", description = "获取向量数据库统计信息")
    public ResponseEntity<Map<String, Object>> getStats() {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("totalDocuments", ragService.getDocumentCount());
        response.put("totalQuestions", questionVectorService.getQuestionCount());
        response.put("embeddingDimension", 1024);
        response.put("embeddingModel", "text-embedding-v4");
        response.put("indexType", "FLAT");

        return ResponseEntity.ok(response);
    }

    @PostMapping("/questions/import")
    @Operation(summary = "导入题目到向量数据库（异步）", description = "将所有题目批量导入到向量数据库，异步执行不阻塞")
    public ResponseEntity<Map<String, Object>> importQuestions() {
        questionVectorService.importQuestionsAsync();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "题目导入任务已启动，请稍后调用统计接口查看进度");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/questions/{id}/similar")
    @Operation(summary = "查找相似题目", description = "根据题目ID查找语义相似的其他题目")
    public ResponseEntity<Map<String, Object>> findSimilarByQuestionId(
            @Parameter(description = "题目ID")
            @PathVariable Long id,
            @Parameter(description = "返回数量")
            @RequestParam(defaultValue = "5") int topK) {

        try {
            List<QuestionVectorService.QuestionVectorResult> results =
                    questionVectorService.findSimilarByQuestionId(id, topK);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("questionId", id);
            response.put("totalResults", results.size());
            response.put("results", results);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("查找相似题目失败: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    @GetMapping("/questions/search")
    @Operation(summary = "文本搜索相似题目", description = "根据文本描述查找语义相似的题目")
    public ResponseEntity<Map<String, Object>> searchSimilarQuestions(
            @Parameter(description = "查询文本（可以是题目内容、知识点、答案等）")
            @RequestParam String query,
            @Parameter(description = "返回数量")
            @RequestParam(defaultValue = "5") int topK) {

        try {
            List<QuestionVectorService.QuestionVectorResult> results =
                    questionVectorService.findSimilarByText(query, topK);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("query", query);
            response.put("totalResults", results.size());
            response.put("results", results);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("搜索相似题目失败: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    @DeleteMapping("/questions")
    @Operation(summary = "清空题目向量索引", description = "清空所有题目的向量数据")
    public ResponseEntity<Map<String, Object>> clearQuestionsIndex() {
        try {
            questionVectorService.clearIndex();
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "题目向量索引已清空");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("清空题目索引失败: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
}
