package com.smarttcm.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class RagService {

    private static final Logger logger = LoggerFactory.getLogger(RagService.class);

    private final VectorStoreService vectorStoreService;
    private final DocumentProcessorService documentProcessorService;
    private final DeepSeekService deepSeekService;

    @Value("${rag.max-results:5}")
    private int maxResults;

    public RagService(VectorStoreService vectorStoreService,
                      DocumentProcessorService documentProcessorService,
                      DeepSeekService deepSeekService) {
        this.vectorStoreService = vectorStoreService;
        this.documentProcessorService = documentProcessorService;
        this.deepSeekService = deepSeekService;
    }

    public String query(String question) {
        return query(question, maxResults);
    }

    public String query(String question, int topK) {
        try {
            List<VectorStoreService.SearchResult> searchResults = 
                vectorStoreService.search(question, topK);

            if (searchResults.isEmpty()) {
                return "抱歉，数据库中没有找到相关信息。请先上传相关文档。";
            }

            String context = buildContext(searchResults);
            String answer = generateAnswer(question, context);

            logger.info("RAG 查询完成，问题: {}, 检索到 {} 条相关文档", 
                question, searchResults.size());
            
            return answer;

        } catch (Exception e) {
            logger.error("RAG 查询失败: {}", e.getMessage());
            throw new RuntimeException("RAG 查询失败: " + e.getMessage(), e);
        }
    }

    public List<VectorStoreService.SearchResult> retrieveWithScore(String question) {
        return retrieveWithScore(question, maxResults);
    }

    public List<VectorStoreService.SearchResult> retrieveWithScore(String question, int topK) {
        return vectorStoreService.search(question, topK);
    }

    public String addDocument(String content) {
        List<String> chunks = documentProcessorService.chunkText(content);
        return vectorStoreService.addDocuments(chunks);
    }

    public String addDocumentFromFile(String filename, String content) {
        List<String> chunks = documentProcessorService.chunkText(content);
        String ids = vectorStoreService.addDocuments(chunks);
        logger.info("从文件 {} 添加文档，分块数: {}", filename, chunks.size());
        return ids;
    }

    private String buildContext(List<VectorStoreService.SearchResult> results) {
        StringBuilder context = new StringBuilder();
        context.append("以下是与问题相关的参考资料：\n\n");
        
        for (int i = 0; i < results.size(); i++) {
            VectorStoreService.SearchResult result = results.get(i);
            context.append("【参考 ").append(i + 1).append("】(相似度: ")
                   .append(String.format("%.4f", result.getScore())).append(")\n")
                   .append(result.getText()).append("\n\n");
        }
        
        return context.toString();
    }

    private String generateAnswer(String question, String context) {
        String systemPrompt = "你是千方慧鉴的GraphRAG中医知识库助手。GraphRAG用于高召回检索：先尽量召回相关知识片段，再由大模型进行去重、归纳、交叉核对。请根据提供的参考资料回答用户的问题。\n\n"
            + "回答要求：\n"
            + "1. 只基于参考资料中的信息回答，不要编造内容\n"
            + "2. 如果参考资料不足，请明确说明\"当前知识库证据不足\"，并给出还需要补充哪些资料\n"
            + "3. 回答要准确、简洁、有条理\n"
            + "4. 如果多条参考资料都相关，请综合整理后回答，并保留关键依据";

        String userPrompt = context + "\n\n用户问题：" + question + "\n\n请根据以上参考资料回答：";

        try {
            String answer = deepSeekService.chat(systemPrompt, userPrompt);
            if (answer == null || answer.isBlank()) {
                return buildEvidenceOnlyAnswer(question, context);
            }
            return answer;
        } catch (Exception e) {
            logger.error("调用 LLM 生成回答失败，降级为证据摘要: {}", e.getMessage());
            return buildEvidenceOnlyAnswer(question, context);
        }
    }

    private String buildEvidenceOnlyAnswer(String question, String context) {
        return "已为问题【" + question + "】完成GraphRAG高召回检索，但大模型总结服务暂时不可用。\n\n"
            + "以下为知识库原始证据摘要，供人工核对：\n"
            + context
            + "\n提示：当前回答为降级结果，建议稍后重试以获得完整综合解读。";
    }

    public int getDocumentCount() {
        return vectorStoreService.getDocumentCount();
    }

    public boolean deleteDocument(String id) {
        return vectorStoreService.deleteDocument(id);
    }

    public void clearAllDocuments() {
        vectorStoreService.clearIndex();
    }
}
