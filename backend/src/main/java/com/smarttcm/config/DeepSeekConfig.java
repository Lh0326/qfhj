package com.smarttcm.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * DeepSeek AI Configuration - DeepSeek AI 配置
 */
@Configuration
@ConfigurationProperties(prefix = "deepseek")
public class DeepSeekConfig {

    /**
     * DeepSeek API Key
     */
    private String apiKey;

    /**
     * API Base URL
     */
    private String baseUrl = "https://api.deepseek.com/v1";

    /**
     * 模型名称
     */
    private String model = "deepseek-chat";

    /**
     * 温度参数（0-2，越高越有创意）
     */
    private double temperature = 0.7;

    /**
     * 最大生成 tokens
     */
    private int maxTokens = 4096;

    /**
     * 是否启用本地微调模型：启用后先由本地模型生成草稿，再由 Qwen 润色。
     */
    private boolean localEnabled = false;

    /**
     * 本地微调模型 OpenAI-compatible Base URL
     */
    private String localBaseUrl = "http://127.0.0.1:8000/v1";

    /**
     * 本地微调模型 API Key，可为空。
     */
    private String localApiKey = "local";

    /**
     * 本地微调模型名称。
     */
    private String localModel = "traditional_medical";

    /**
     * 本地模型兜底最大生成 tokens。
     */
    private int localMaxTokens = 768;

    /**
     * AI 编排模式：cloud_first / local_draft_qwen_refine / local_only。
     */
    private String aiMode = "cloud_first";

    /**
     * 中医问诊是否启用“本地微调模型短草稿 + Qwen润色”专业增强链路。
     */
    private boolean localDraftEnabled = false;

    /**
     * 本地草稿超时时间。保持很短，避免破坏流式输出体验。
     */
    private long localDraftTimeoutMs = 2500;

    /**
     * 本地草稿 token 上限。只要提取中医线索，不让弱模型长篇输出。
     */
    private int localDraftMaxTokens = 160;

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }
    public int getMaxTokens() { return maxTokens; }
    public void setMaxTokens(int maxTokens) { this.maxTokens = maxTokens; }
    public boolean isLocalEnabled() { return localEnabled; }
    public void setLocalEnabled(boolean localEnabled) { this.localEnabled = localEnabled; }
    public String getLocalBaseUrl() { return localBaseUrl; }
    public void setLocalBaseUrl(String localBaseUrl) { this.localBaseUrl = localBaseUrl; }
    public String getLocalApiKey() { return localApiKey; }
    public void setLocalApiKey(String localApiKey) { this.localApiKey = localApiKey; }
    public String getLocalModel() { return localModel; }
    public void setLocalModel(String localModel) { this.localModel = localModel; }
    public int getLocalMaxTokens() { return localMaxTokens; }
    public void setLocalMaxTokens(int localMaxTokens) { this.localMaxTokens = localMaxTokens; }
    public String getAiMode() { return aiMode; }
    public void setAiMode(String aiMode) { this.aiMode = aiMode; }
    public boolean isLocalDraftEnabled() { return localDraftEnabled; }
    public void setLocalDraftEnabled(boolean localDraftEnabled) { this.localDraftEnabled = localDraftEnabled; }
    public long getLocalDraftTimeoutMs() { return localDraftTimeoutMs; }
    public void setLocalDraftTimeoutMs(long localDraftTimeoutMs) { this.localDraftTimeoutMs = localDraftTimeoutMs; }
    public int getLocalDraftMaxTokens() { return localDraftMaxTokens; }
    public void setLocalDraftMaxTokens(int localDraftMaxTokens) { this.localDraftMaxTokens = localDraftMaxTokens; }
}

