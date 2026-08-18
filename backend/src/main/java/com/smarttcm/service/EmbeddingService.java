package com.smarttcm.service;

import com.smarttcm.config.DashScopeConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class EmbeddingService {

    private static final Logger logger = LoggerFactory.getLogger(EmbeddingService.class);

    private final DashScopeConfig dashScopeConfig;
    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public EmbeddingService(DashScopeConfig dashScopeConfig, ObjectMapper objectMapper) {
        this.dashScopeConfig = dashScopeConfig;
        this.objectMapper = objectMapper;
        this.webClient = WebClient.builder()
                .baseUrl(dashScopeConfig.getBaseUrl())
                .defaultHeader("Authorization", "Bearer " + dashScopeConfig.getApiKey())
                .build();
    }

    public List<Float> embedText(String text) {
        try {
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", dashScopeConfig.getEmbeddingModel());
            requestBody.put("input", text);

            String response = webClient.post()
                    .uri("/embeddings")
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = objectMapper.readTree(response);
            JsonNode embeddingNode = root.path("data").get(0).path("embedding");
            
            List<Float> embedding = new ArrayList<>();
            for (JsonNode num : embeddingNode) {
                embedding.add((float) num.asDouble());
            }
            
            logger.debug("成功生成 embedding, 维度: {}", embedding.size());
            return embedding;

        } catch (Exception e) {
            logger.error("生成 embedding 失败: {} | text length: {}", e.getMessage(),
                text != null ? text.length() : 0);
            throw new RuntimeException("Embedding 生成失败: " + e.getMessage(), e);
        }
    }

    public List<List<Float>> embedTexts(List<String> texts) {
        try {
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", dashScopeConfig.getEmbeddingModel());
            requestBody.put("input", texts);

            String response = webClient.post()
                    .uri("/embeddings")
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = objectMapper.readTree(response);
            JsonNode dataArray = root.path("data");
            
            List<List<Float>> embeddings = new ArrayList<>();
            for (JsonNode item : dataArray) {
                List<Float> embedding = new ArrayList<>();
                for (JsonNode num : item.path("embedding")) {
                    embedding.add((float) num.asDouble());
                }
                embeddings.add(embedding);
            }
            
            logger.debug("成功批量生成 {} 个 embeddings", embeddings.size());
            return embeddings;

        } catch (org.springframework.web.reactive.function.client.WebClientResponseException.BadRequest e) {
            try {
                String body = e.getResponseBodyAsString();
                logger.error("批量生成 embedding 失败 (400): {} | batch size: {} | 详情: {}",
                    e.getMessage(), texts.size(), body);
            } catch (Exception ignored) {
                logger.error("批量生成 embedding 失败 (400): {} | batch size: {}",
                    e.getMessage(), texts.size());
            }
            throw new RuntimeException("批量 Embedding 生成失败: " + e.getMessage(), e);
        } catch (Exception e) {
            logger.error("批量生成 embedding 失败: {} | batch size: {}", e.getMessage(), texts.size());
            throw new RuntimeException("批量 Embedding 生成失败: " + e.getMessage(), e);
        }
    }

    public int getDimension() {
        return 1024;
    }
}
