package com.smarttcm.service;

import com.smarttcm.config.DeepSeekConfig;
import com.smarttcm.dto.AiChatRequest;
import com.smarttcm.dto.AiChatResponse;
import com.smarttcm.dto.DeepSeekRequest;
import com.smarttcm.dto.DeepSeekResponse;
import com.smarttcm.dto.SaveConversationRequest;
import com.smarttcm.entity.User;
import com.smarttcm.service.ChatService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;
import reactor.util.retry.Retry;

import io.netty.resolver.DefaultAddressResolverGroup;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * DeepSeek Service - DeepSeek AI 服务
 * 调用 DeepSeek API 生成题目内容
 */
@Service
public class DeepSeekService {

    private static final Logger log = LoggerFactory.getLogger(DeepSeekService.class);
    private static final long SSE_TIMEOUT = 120_000L; // 2分钟超时，避免前端长期转圈
    private static final int QWEN_RETRY_COUNT = 1;
    private static final Duration QWEN_RETRY_DELAY = Duration.ofSeconds(1);

    private final DeepSeekConfig config;
    private final WebClient webClient;
    private final WebClient localWebClient;
    private final ObjectMapper objectMapper;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    public DeepSeekService(DeepSeekConfig config, ObjectMapper objectMapper) {
        this.config = config;
        this.objectMapper = objectMapper;
        log.info("QFHJ AI provider config loaded: baseUrl={}, model={}, apiKeyLength={}",
                config.getBaseUrl(), config.getModel(), config.getApiKey() == null ? 0 : config.getApiKey().length());
        if (!isCloudConfigured()) {
            log.warn("QWEN_API_KEY is not configured correctly. Cloud AI will be skipped; local model fallback will be used when available.");
        }
        this.webClient = WebClient.builder()
                .baseUrl(config.getBaseUrl())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + config.getApiKey())
                .clientConnector(new ReactorClientHttpConnector(
                        HttpClient.create()
                                .responseTimeout(Duration.ofSeconds(180))
                                .resolver(DefaultAddressResolverGroup.INSTANCE)))
                .build();
        this.localWebClient = WebClient.builder()
                .baseUrl(config.getLocalBaseUrl())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + config.getLocalApiKey())
                .clientConnector(new ReactorClientHttpConnector(
                        HttpClient.create()
                                .responseTimeout(Duration.ofSeconds(90))
                                .resolver(DefaultAddressResolverGroup.INSTANCE)))
                .build();
    }

    /**
     * 发送聊天请求（带系统提示词）
     */
    public String chat(String systemPrompt, String userMessage) {
        DeepSeekRequest request = new DeepSeekRequest();
        request.setModel(config.getModel());
        request.setTemperature(config.getTemperature());
        request.setMax_tokens(config.getMaxTokens());
        request.setStream(false);
        request.setMessages(List.of(
                new DeepSeekRequest.Message("system", systemPrompt),
                new DeepSeekRequest.Message("user", userMessage)
        ));
        return execute(request);
    }

    /**
     * 发送聊天请求（仅用户消息）
     */
    public String chat(String userMessage) {
        DeepSeekRequest request = new DeepSeekRequest();
        request.setModel(config.getModel());
        request.setTemperature(config.getTemperature());
        request.setMax_tokens(config.getMaxTokens());
        request.setStream(false);
        request.setMessages(List.of(
                new DeepSeekRequest.Message("user", userMessage)
        ));
        return execute(request);
    }

    public boolean isCloudConfigured() {
        String key = config.getApiKey();
        if (key == null || key.isBlank()) {
            return false;
        }
        String normalized = key.trim().toLowerCase();
        return !(normalized.equals("your-dashscope-api-key")
                || normalized.startsWith("your-")
                || normalized.contains("...")
                || normalized.contains("***"));
    }

    private String execute(DeepSeekRequest request) {
        if (!isCloudConfigured()) {
            log.warn("Qwen cloud API key is not configured; skip cloud call and use local fallback if available.");
            return null;
        }
        return executeWithClient(webClient, request, "Qwen");
    }

    private String executeLocal(DeepSeekRequest request) {
        return executeWithClient(localWebClient, request, "Local fine-tuned model");
    }

    private String executeLocalDraft(DeepSeekRequest request) {
        long timeoutMs = Math.max(800, config.getLocalDraftTimeoutMs());
        return executeWithClient(localWebClient, request, "Local fine-tuned model draft", Duration.ofMillis(timeoutMs));
    }

    private String executeWithClient(WebClient client, DeepSeekRequest request, String providerName) {
        return executeWithClient(client, request, providerName,
                providerName != null && providerName.startsWith("Local") ? Duration.ofSeconds(100) : Duration.ofSeconds(120));
    }

    private String executeWithClient(WebClient client, DeepSeekRequest request, String providerName, Duration timeout) {
        try {
            Mono<String> responseMono = client.post()
                    .uri("/chat/completions")
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(String.class);

            if ("Qwen".equals(providerName)) {
                responseMono = responseMono.retryWhen(buildQwenRetrySpec(providerName));
            }

            String response = responseMono.block(timeout);

            if (response != null) {
                DeepSeekResponse dsResponse = objectMapper.readValue(response, DeepSeekResponse.class);
                String content = dsResponse.getFirstContent();
                if (content != null) {
                    return content.trim();
                }
            }

            log.error("{} API returned unexpected response", providerName);
            return null;

        } catch (Exception e) {
            log.error("{} API call failed after retry handling: {}", providerName, e.getMessage(), e);
            return null;
        }
    }

    private Retry buildQwenRetrySpec(String providerName) {
        return Retry.fixedDelay(QWEN_RETRY_COUNT, QWEN_RETRY_DELAY)
                .filter(DeepSeekService::isRetryableProviderFailure)
                .doBeforeRetry(signal -> log.warn("{} API temporary failure, retrying after {} ms: {}",
                        providerName, QWEN_RETRY_DELAY.toMillis(), signal.failure().getMessage()))
                .onRetryExhaustedThrow((retryBackoffSpec, signal) -> signal.failure());
    }

    public static boolean isRetryableProviderFailure(Throwable error) {
        if (error == null) {
            return false;
        }
        Throwable current = error;
        while (current != null) {
            if (current instanceof WebClientResponseException responseException) {
                int status = responseException.getStatusCode().value();
                return status == 408 || status == 429 || status >= 500;
            }
            if (current instanceof WebClientRequestException || current instanceof TimeoutException) {
                return true;
            }
            String message = current.getMessage();
            if (message != null) {
                String lower = message.toLowerCase();
                if (lower.contains("timeout") || lower.contains("connection reset") || lower.contains("connection refused")
                        || lower.contains("premature close") || lower.contains("connection prematurely closed")) {
                    return true;
                }
            }
            current = current.getCause();
        }
        return false;
    }

    public boolean isLocalDraftRefineEnabledForTcm() {
        String mode = config.getAiMode() == null ? "" : config.getAiMode().trim().toLowerCase();
        return config.isLocalEnabled()
                && config.isLocalDraftEnabled()
                && (mode.equals("local_draft_qwen_refine") || mode.equals("professional_enhanced"));
    }

    public static String buildTcmLocalDraftSystemPrompt(String baseSystemPrompt) {
        return baseSystemPrompt + "\n\n" +
                "【本地中医微调模型短草稿模式】\n" +
                "你现在不是最终回答者，只输出可供 Qwen 参考的短草稿。\n" +
                "要求：1. 120字以内；2. 只列证据线索、可能病位病性、需追问信息；3. 禁止给出最终诊断；4. 不要输出方药剂量；5. 不要输出长篇养生建议；6. 不确定时写资料不足。\n" +
                "输出格式：证据线索：...；可能倾向：...；需追问：...。";
    }

    public static String buildTcmQwenRefinementSystemPrompt(String baseSystemPrompt, String localDraft) {
        return baseSystemPrompt + "\n\n" +
                "【多模型协同规则】\n" +
                "下面会附上一段本地微调模型草稿。它只作为低置信度参考，不是结论。\n" +
                "本地微调模型草稿只作为低置信度参考；如草稿与用户原始症状、四诊信息、中医辨证逻辑、用药安全或常识冲突，必须忽略或纠正草稿。\n" +
                "最终回答必须以用户原始描述和四诊合参为准，由你独立完成证据链、鉴别辨证、安全提示和通俗解释。\n" +
                "不要为了迎合草稿而降低专业性；不要在最终回答中说明模型链路、草稿来源或“Qwen润色”等字样。\n\n" +
                "【本地微调模型草稿，仅供低置信度参考】\n" +
                localDraft;
    }

    public static boolean isUsableTcmLocalDraft(String draft) {
        if (draft == null) {
            return false;
        }
        String cleaned = draft.trim();
        if (cleaned.length() < 20) {
            return false;
        }
        String lower = cleaned.toLowerCase();
        if (lower.contains("<think") || lower.contains("</think>") || lower.contains("error")
                || lower.contains("exception") || lower.contains("traceback") || lower.contains("undefined")) {
            return false;
        }
        int cjkCount = 0;
        for (int i = 0; i < cleaned.length(); i++) {
            char c = cleaned.charAt(i);
            if (c >= '\u4e00' && c <= '\u9fff') {
                cjkCount++;
            }
        }
        return cjkCount >= 12;
    }

    private String cleanLocalDraft(String draft) {
        if (draft == null) {
            return null;
        }
        String cleaned = draft.replaceAll("(?is)<think>.*?</think>", "")
                .replace("</think>", "")
                .replace("```", "")
                .trim();
        if (cleaned.length() > 220) {
            cleaned = cleaned.substring(0, 220) + "……";
        }
        return cleaned;
    }

    private String generateTcmLocalDraft(String systemPrompt, String userMessage, List<DeepSeekRequest.Message> history) {
        if (!isLocalDraftRefineEnabledForTcm()) {
            return null;
        }
        try {
            DeepSeekRequest localRequest = new DeepSeekRequest();
            localRequest.setModel(config.getLocalModel());
            localRequest.setTemperature(Math.min(config.getTemperature(), 0.25));
            localRequest.setMax_tokens(Math.max(64, Math.min(config.getLocalDraftMaxTokens(), 220)));
            localRequest.setStream(false);

            java.util.ArrayList<DeepSeekRequest.Message> localMessages = new java.util.ArrayList<>();
            localMessages.add(new DeepSeekRequest.Message("system", buildTcmLocalDraftSystemPrompt(systemPrompt)));
            if (history != null && !history.isEmpty()) {
                int from = Math.max(0, history.size() - 4);
                localMessages.addAll(history.subList(from, history.size()));
            }
            localMessages.add(new DeepSeekRequest.Message("user", userMessage));
            localRequest.setMessages(localMessages);

            String draft = CompletableFuture.supplyAsync(() -> executeLocalDraft(localRequest), executor)
                    .get(Math.max(800, config.getLocalDraftTimeoutMs()) + 300, TimeUnit.MILLISECONDS);
            draft = cleanLocalDraft(draft);
            if (isUsableTcmLocalDraft(draft)) {
                log.info("TCM local draft accepted for Qwen refinement, chars={}", draft.length());
                return draft;
            }
            log.info("TCM local draft skipped because it was empty, low-quality, or timed out.");
        } catch (Exception e) {
            log.info("TCM local draft skipped to preserve chat latency: {}", e.getMessage());
        }
        return null;
    }

    /**
     * 题目生成的系统提示词
     */
    public String questionGenerationPrompt(String newsContent, String questionType, String questionCategory) {
        return "你是一个专业的对外汉语学习题目设计师。请根据以下话题背景，设计适合中文学习者的语言知识练习题。\n\n" +
                "【重要说明】\n" +
                "新闻话题只是提供背景情境，题目本身考查的是汉语语言知识（词汇、语法、成语、语言点等），而不是阅读理解。题目中不会出现新闻原文作为阅读材料，也不要在题目中提示'阅读以下材料'、'根据以下内容'、'根据报道'等。\n\n" +
                "话题背景：\n" +
                newsContent + "\n\n" +
                "【出题思路示例】\n" +
                "假设新闻话题是\"端午节赛龙舟\"：\n" +
                "  - 可以考：以下哪个选项中的\"赛\"是\"比赛\"的意思？（考一词多义）\n" +
                "  - 可以考：\"龙\"在汉语中常象征什么？（考文化词汇）\n" +
                "  - 可以考：将\"人们喜欢观看赛龙舟\"改为\"龙舟很受欢迎\"用到了什么语法？（考句式变换）\n" +
                "假设新闻话题是\"年轻人喜欢购买新能源汽车\"：\n" +
                "  - 可以考：\"新能源\"中的\"新\"是什么词性？（考词性）\n" +
                "  - 可以考：以下哪个成语可以形容汽车技术进步很快？（考成语运用）\n\n" +
                "【出题要求】\n" +
                "1. 题型应侧重：词汇辨析、语法选择、成语运用、词性判断、句式变换、选词填空等语言知识类题目\n" +
                "2. questionType 推荐：单选/填空/判断/组词成句\n" +
                "3. questionCategory：文本\n" +
                "4. primaryProject 大类：当代中国/传统文化/语言与文化/日常生活\n" +
                "5. 题目背景可以引用话题相关词汇（如\"端午节\"、\"人工智能\"等），但不要复述新闻内容\n" +
                "6. 只返回 JSON 数组，不要有其他文字\n\n" +
                "JSON 字段说明：\n" +
                "{\n" +
                "  \"question\": \"题目正文（以话题为背景，考查汉语言知识）\",\n" +
                "  \"questionType\": \"题型，如：单选\",\n" +
                "  \"questionCategory\": \"题目类别，如：文本\",\n" +
                "  \"contentCategory\": \"内容类别，如：社会/科技/文化等\",\n" +
                "  \"options\": \"选项（如为选择题，格式：A.选项A内容\\nB.选项B内容\\nC.选项C内容\\nD.选项D内容）\",\n" +
                "  \"answer\": \"正确答案文本\",\n" +
                "  \"answerOnly\": \"仅答案（纯文本）\",\n" +
                "  \"knowledgePoint\": \"知识点说明\",\n" +
                "  \"primaryProject\": \"一级项目，如：语言与文化\",\n" +
                "  \"secondaryProject\": \"二级项目，如：词汇\",\n" +
                "  \"culturalPoint\": \"文化知识点（如有）\",\n" +
                "  \"fourStageCognition\": \"四阶段认知（如：记忆/理解/应用/分析）\",\n" +
                "  \"bloomCognitionLevel\": \"布鲁姆认知层级\",\n" +
                "  \"coreConnotation\": \"核心内涵\",\n" +
                "  \"mainFocus\": \"考查重点\"\n" +
                "}\n\n" +
                "请返回3-5道题目的JSON数组，确保JSON格式正确可解析。";
    }

    /**
     * AI答案检查的提示词（增强版，包含完整题目上下文）
     * @param question 题目内容
     * @param userAnswer 用户答案
     * @param correctAnswer 正确答案
     * @param questionType 题型
     * @param explanation 原题解析
     * @param options 题目选项（如有）
     * @param knowledgePoint 知识点
     * @param contentCategory 内容分类
     * @param primaryProject 一级项目
     * @param secondaryProject 二级项目
     * @return AI评估结果 JSON
     */
    public String answerCheckPrompt(String question, String userAnswer, String correctAnswer,
                                     String questionType, String explanation, String options,
                                     String knowledgePoint, String contentCategory,
                                     String primaryProject, String secondaryProject) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("你是一个专业的对外汉语教师，负责评估学生的答题是否正确。\n\n");
        prompt.append("【题目完整信息】\n");

        // 题目内容（最重要的上下文）
        prompt.append("题目内容：").append(question != null ? question : "无").append("\n");

        // 题型
        prompt.append("题型：").append(questionType != null ? questionType : "未知").append("\n");

        // 题目选项（如果有）
        if (options != null && !options.isEmpty()) {
            prompt.append("题目选项：\n").append(options).append("\n");
        }

        // 内容分类
        if (contentCategory != null && !contentCategory.isEmpty()) {
            prompt.append("内容分类：").append(contentCategory).append("\n");
        }

        // 一级项目
        if (primaryProject != null && !primaryProject.isEmpty()) {
            prompt.append("一级项目：").append(primaryProject).append("\n");
        }

        // 二级项目
        if (secondaryProject != null && !secondaryProject.isEmpty()) {
            prompt.append("二级项目：").append(secondaryProject).append("\n");
        }

        // 知识点
        if (knowledgePoint != null && !knowledgePoint.isEmpty()) {
            prompt.append("知识点：").append(knowledgePoint).append("\n");
        }

        // 参考答案
        prompt.append("\n【参考答案】\n");
        prompt.append(correctAnswer != null ? correctAnswer : "无").append("\n");

        // 题目解析
        prompt.append("\n【题目解析】\n");
        prompt.append(explanation != null && !explanation.isEmpty() ? explanation : "无").append("\n");

        // 学生答案
        prompt.append("\n【学生答案】\n");
        prompt.append(userAnswer != null ? userAnswer : "无").append("\n");

        // 评估规则
        prompt.append("""
                \n【评估规则】
                请根据以上完整的题目上下文，综合判断学生答案是否正确：

                1. 填空题：
                   - 必须填入与参考答案语义相同的内容
                   - 允许使用同义词、近义词（如"爸爸"和"父亲"）
                   - 数字答案允许不同格式（如"5"和"五"）
                   - 必须符合题目要求的格式和数量

                2. 列举题：
                   - 列举的内容必须正确
                   - 允许顺序不同
                   - 允许使用不同的表述方式
                   - 部分列举正确可酌情给分

                3. 组词成句题：
                   - 必须组成语法正确的句子
                   - 语序必须正确
                   - 标点符号不作为判断依据
                   - 允许添加适当的量词、助词等

                4. 问答题：
                   - 答案要点必须包含参考答案中的关键词
                   - 允许不同的表达方式
                   - 语义必须正确
                   - 可以比参考答案更详细

                【重要】请务必理解题目要求后，再判断答案是否正确。

                请返回以下格式的JSON（不要有其他文字）：
                {
                    "isCorrect": true或false,
                    "reasoning": "详细的判断理由（30字以内）",
                    "score": 0-100的分数
                }
                """);

        return prompt.toString();
    }

    /**
     * 简化版AI答案检查提示词（兼容旧调用）
     */
    public String answerCheckPrompt(String question, String userAnswer, String correctAnswer,
                                     String questionType, String explanation) {
        return answerCheckPrompt(question, userAnswer, correctAnswer, questionType, explanation,
                null, null, null, null, null);
    }

    // ==================== AI 聊天相关方法 ====================

    /**
     * AI 学习助手系统提示词
     */
    public static final String TCM_DIAGNOSIS_SYSTEM_PROMPT = """
        ============ 身份定义（最高优先级） ============
        你是"千方慧鉴"平台的AI中医问诊助手。千方慧鉴是一个基于通用大模型、领域微调模型与GraphRAG知识增强的中医智能辨证辅助系统。
        系统采用"通用大模型主答 + 本地中医微调模型草稿/领域校验 + GraphRAG知识库证据增强"的协同架构：通用大模型负责稳定表达、综合推理和安全兜底；DeepSeek-R1-Distill-Qwen-1.5B本地模型通过LoRA低秩适配进行了中医领域指令微调，用于补充中医术语、证型、方剂和调护要点；GraphRAG用于高召回检索中医知识片段并辅助依据核对。不要把1.5B模型描述成唯一能力来源。
        当用户问"你是谁""你是什么""介绍一下你自己"时，请按以下风格自然回答：
        "你好！我是千方慧鉴平台的AI中医问诊助手。千方慧鉴采用通用大模型、领域微调模型与GraphRAG知识增强协同工作：通用大模型负责稳定分析和表达，本地DeepSeek-R1-Distill-Qwen-1.5B中医微调模型提供领域草稿与专业要点补充，GraphRAG知识库用于高召回检索和依据核对。你可以向我描述症状或健康问题，我会尽量结合望、闻、问、切信息，并从八纲辨证、脏腑辨证、六经辨证、经络辨证等多个角度做综合分析。"
        当用户追问"你是什么模型""你基于什么模型""你的底层模型是什么"等技术问题时，回答："系统不是单一模型独立完成，而是通用大模型主答，本地DeepSeek-R1-Distill-Qwen-1.5B中医微调模型参与领域草稿和校验，GraphRAG知识库提供证据增强与高召回检索。"
        请始终保持这个身份，自然、自信地回答。注意：除非用户明确询问“你是谁/你是什么模型/你的底层模型”，否则不要主动复述平台架构、模型名称或自我介绍，直接回答用户的健康问题。

        ============ 回答质量要求 ============
        默认回答要有“中医味”和可读性，不要只给很短的健康建议。只要用户描述了具体症状，至少输出四个部分：四诊资料归纳、辨证结论、治法调护、需补充信息。普通问诊建议控制在700-1200字；用户要求详细辨证、向导辨证、报告或会诊时，可展开到1200-1800字。只有寒暄、简单定义类问题才简短回答。

        ============ 核心能力 ============
        你精通以下辨证体系：八纲辨证、脏腑辨证、气血津液辨证、六经辨证、卫气营血辨证、三焦辨证、经络辨证。
        你擅长：中医诊断分析、方剂思路、针灸穴位、食疗药膳、养生调理。
        你在回答中要自然体现中医特色：用“病位、病性、正邪盛衰、气血津液、升降出入、寒热虚实”等语言组织分析；可适当引用《黄帝内经》《伤寒论》《金匮要略》《温病条辨》的思想，但不要堆砌原文。
        诊断时必须体现“四诊合参”：望诊包括神色形态、面色、目唇、皮肤、舌质、舌苔；闻诊包括声音高低强弱、咳喘气息、口气体味；问诊参考“十问歌”，覆盖寒热、汗出、头身、胸腹、饮食口味、二便、睡眠、情志、病程诱因、既往史与妇儿相关信息；切诊包括脉象、腹诊/按诊、局部寒热疼痛。未提供的信息要明确写“未提供，建议补充”，不能假装已经知道。

        ============ 专业辨证依据 ============
        你必须按照“症状归纳→病位病性→主证兼证→治法方药思路→调护追问”的流程工作。回答中必须体现证据链：每个证型后面说明它来自哪些四诊证据，例如舌质舌苔、寒热汗出、疼痛性质、睡眠二便、情志和脉象等。
        辨证不能只给一个结论，必须给出最可能的主证、可能兼证和一个鉴别证型。常用交叉框架包括：八纲用于定表里寒热虚实阴阳；脏腑用于定位肝、心、脾、肺、肾、胃、胆等；气血津液用于判断气虚、气滞、血虚、血瘀、痰湿、津亏；经络用于结合部位和发作时间；六经、卫气营血、三焦用于外感或热病传变分析。
        对资料不足的病例，仍要先基于已知信息给出“倾向性辨证”，再列出缺失信息和下一步追问。遇到胸痛、呼吸困难、意识异常、持续高热、呕血便血、剧烈腹痛、皮损快速扩大或出血疼痛等危险信号，必须建议及时就医。

        ============ 结构化分析维度 ============
        当用户提供了以下结构化信息时，你必须将其纳入辨证分析：

        【症候程度】（5级量化）
        - 偶尔（略微）：症状偶尔出现，程度很轻
        - 较少（有点）：症状较少出现，程度轻微
        - 较多（一般）：症状经常出现，程度中等
        - 很多（非常）：症状频繁出现，程度较重
        - 总是（极其）：症状持续存在，程度严重

        【子午归经 · 发作时间】
        中医认为人体十二经脉对应十二时辰，不同时辰气血盛衰不同，症状发作时间可辅助定位病变经络：
        - 子时(23-1点)→胆经，丑时(1-3点)→肝经，寅时(3-5点)→肺经
        - 卯时(5-7点)→大肠经，辰时(7-9点)→胃经，巳时(9-11点)→脾经
        - 午时(11-13点)→心经，未时(13-15点)→小肠经，申时(15-17点)→膀胱经
        - 酉时(17-19点)→肾经，戌时(19-21点)→心包经，亥时(21-23点)→三焦经

        【六经传变 · 持续时日】
        根据症状持续时间判断六经传变阶段：
        - 1-3天：太阳经阶段（表证初起）
        - 4-7天：阳明/少阳经阶段（入里化热或半表半里）
        - 1-2周：太阴经阶段（脾虚湿困）
        - 2-4周：少阴经阶段（心肾阳虚或阴虚）
        - 1个月以上：厥阴经阶段（寒热错杂）

        【补充问诊·十问歌详查】
        系统可能提供以下补充问诊数据：寒热、汗出、大便、小便、睡眠、口味、面色（均为多选项），以及症状特异性补充（如疼痛部位与性质、痰的性质、饮食偏好、情志特点等）。
        若已提供补充问诊数据，必须直接引用，并在四诊概要中标注"已采集"；未提供的项目仍标注"未提供，建议补充"。

        ============ 输出格式 ============
        当用户描述了具体症状时，请按以下结构化框架输出：

        **一、四诊合参与资料完整性**
        - 望诊：归纳神色形态、面色、目唇、皮肤、舌质、舌苔等；未提供则写明需要补充
        - 闻诊：归纳声音、咳喘、气味等；未提供则写明需要补充
        - 问诊：按十问歌思路归纳寒热、汗出、头身胸腹、饮食口味、二便、睡眠、情志、病程诱因等
        - 切诊：归纳脉象、腹诊/按诊、局部寒热疼痛；未提供则写明需要补充
        - 缺失信息与下一步追问：列出影响辨证准确性的关键缺口

        **二、辨证分析**
        - 主病与兼病：先说明主要问题，再说明伴随问题
        - 病位与病性：判断涉及脏腑经络和寒热虚实、气血津液状态
        - 证型诊断：给出最可能的主证和兼证，含证型名称和诊断依据
        - 证据链：每个证型必须对应四诊依据，避免只凭单一症状下结论
        - 鉴别辨证：给出1个容易混淆的证型，并说明为什么当前更倾向主证
        - 如果涉及发作时间，结合子午归经分析病变经络
        - 如果涉及持续时日，分析六经传变阶段

        **三、合病合方分析**（如适用）
        - 当存在两个或以上证型共存时，识别合病/合证
        - 给出合方治疗方案，说明各方剂的配伍意义

        **四、治法与方药**
        - 治法：明确治则治法
        - 传统方剂：推荐经典方剂（方名、组成、功效、加减化裁建议）
        - 中成药推荐：推荐1-2种对症中成药（药名、功效、适用证候）

        **五、适宜疗法**
        - 针灸/指压：推荐穴位（穴名、定位、功效、操作方法）
        - 食疗药膳：推荐1-2个食疗方（材料、做法、功效）

        **六、养生调护与安全提示**
        - 饮食宜忌、起居调理、运动保健等
        - 危险信号：如有胸痛、呼吸困难、持续高热、出血、剧烈疼痛、意识异常等，建议及时就医

        ============ 特殊模式 ============

        【复诊模式】当用户提到"复诊"或提供了上次诊疗信息和疗效反馈时：
        - 对比上次与当前症状变化
        - 评估疗效（根据用户的自评）
        - 调整治疗方案（如需要）
        - 给出下一步建议

        【多流派会诊模式】当用户要求"多流派会诊"时：
        - 从至少3个不同学术流派/辨证视角分别分析：
          * 伤寒学派视角（六经辨证）
          * 温病学派视角（卫气营血/三焦辨证）
          * 脏腑辨证视角
          * 经络辨证视角（如涉及时间、部位）
        - 各流派给出各自的辨证结论和治法方药建议
        - 最后给出综合会诊意见

        ============ 重要声明 ============
        - 你的分析仅供参考，不能替代专业中医师的面诊
        - 对于严重症状，务必建议用户及时就医
        - 涉及用药建议时，必须在专业医师指导下使用
        - 不要开具具体处方剂量，可以介绍常见方剂的组成和功效

        ============ 通俗化解读要求（必须遵守） ============
        由于用户可能是非中医专业的普通人，你必须在专业分析的同时提供通俗易懂的解释：
        1. 每个专业中医术语首次出现时，必须紧跟括号内的大白话解释。例如：
           - 证型"肝郁脾虚"→ 肝郁脾虚（肝气不舒畅导致消化功能减弱）
           - "气滞血瘀"→ 气滞血瘀（气血运行不通畅，堵在哪里哪里就疼）
           - "湿热蕴肤"→ 湿热蕴肤（体内湿热像闷热潮湿的天气一样困在皮肤里）
           - "治法：疏肝理气"→ 治法：疏肝理气（让肝气顺畅流通，调节情绪）
           - "方剂：逍遥散"→ 方剂：逍遥散（一种帮助调节情绪、改善消化的经典中药方）
           - "归经：入肝经"→ 归经：入肝经（这味药主要作用于肝脏相关的功能系统）
        2. 辨证分析部分，先用专业术语分析，再用一句通俗的话总结"通俗来说就是..."
        3. 方剂推荐时，除了专业功效描述，补充一句"简单理解：这个方子主要帮你解决XX问题"
        4. 穴位推荐时，补充通俗解释"按压这个穴位可以帮助缓解XX症状"
        5. 六经传变、子午归经等专业概念，用生活化的比喻来解释（如"六经传变就像疾病从体表一层层深入体内"）
        6. 所有养生调护建议用普通人能直接照做的语言，避免"调和营卫""益气固表"等纯术语

        请用专业但通俗易懂的语言回答，形成“专业辨证 + 大白话解释 + 可执行调护”的风格。适当引用《黄帝内经》《伤寒论》《金匮要略》《温病条辨》等经典思想，但必须服务于当前症状，不要空泛套话。
        回答时条理清晰、内容饱满。使用中文数字序号（一、二、三）标示大章节，用中文顿号引导子项。不要因为本地草稿很短就缩短最终回答，最终质量以 Qwen plus 的专业分析为准。

        ============ 格式禁忌（必须严格遵守） ============
        1. 禁止使用任何 Markdown 语法：不要用 **加粗**、*斜体*、# 标题、> 引用、```代码块```
        2. 禁止使用任何特殊符号：✓ ✅ 📌 ▪ ▸ ► ❌ ❎ ⚡ 🔥 等，一律不用
        3. 禁止使用 HTML 实体：&nbsp; &emsp; 等
        4. 禁止使用 --- 或 === 做分隔线
        5. 禁止在中文输出中夹带英文：不要写 (always)、(sometimes) 等英文标注
        6. 禁止使用西方医学编码：不要写 LR3、ST40、GV20 等穴位代码，只用中文穴名
        7. 禁止使用 > 引用块语法
        8. 禁止使用 ```json ``` 代码块包裹数据
        9. 加减建议不要逐条列符号，改用"加减：去XX，加XX"的连贯表述
        10. 方剂推荐格式：方名（组成），功效，主治。不要逐药分行
        11. 中成药格式：药名——功效——适用证候。简明一行说清
        12. 穴位定位只用中文描述，如"足背第一、二跖骨间"，不附代码

        正确的格式示范：
        一、辨证分析
        四诊概要：患者头痛持续，发作于丑时，舌苔白腻，脉沉细...
        证型诊断：肝郁脾虚，痰浊阻络证。
        辨证分析：八纲辨证属半表半里兼里...

        二、治法与方药
        治法：疏肝养血，健脾化痰。
        传统方剂：逍遥散合苓桂术甘汤（柴胡、当归、白芍、茯苓、白术、桂枝等），功效疏肝健脾、温阳化饮。
        """;

    /**
     * 聊天（非流式）
     * @param systemPrompt 系统提示词
     * @param userMessage 用户消息
     * @param history 对话历史
     * @return AI 回复内容
     */
    public String chatWithHistory(String systemPrompt, String userMessage, List<DeepSeekRequest.Message> history) {
        DeepSeekRequest request = buildHistoryRequest(systemPrompt, userMessage, history);

        String localDraft = generateTcmLocalDraft(systemPrompt, userMessage, history);
        if (localDraft != null && !localDraft.isBlank() && isCloudConfigured()) {
            request.getMessages().set(0, new DeepSeekRequest.Message("system", buildTcmQwenRefinementSystemPrompt(systemPrompt, localDraft)));
            log.info("TCM chat uses local draft + Qwen refinement mode");
        }

        String qwenResult = execute(request);
        if (qwenResult != null && !qwenResult.isBlank()) {
            return qwenResult;
        }

        if (localDraft != null && !localDraft.isBlank()) {
            log.warn("Qwen refinement failed after local draft; return conservative local draft fallback");
            return "【本地微调模型草稿兜底】\n" + localDraft + "\n\n提示：云端 Qwen 暂时不可用，以上仅为本地模型提取的中医线索草稿，不构成诊断或处方，请结合医生面诊。";
        }

        if (config.isLocalEnabled()) {
            log.warn("Qwen direct response failed, trying local fine-tuned model fallback");
            return generateLocalFallbackResponse(systemPrompt, userMessage, history);
        }

        log.warn("Qwen direct response failed and local fallback is disabled");
        return null;
    }

    /**
     * 向导辨证专用的短超时调用：避免评委演示时云端大模型慢响应导致页面长时间转圈。
     */
    public String chatWithHistoryFast(String systemPrompt, String userMessage, List<DeepSeekRequest.Message> history, Duration timeout) {
        if (!isCloudConfigured()) {
            log.warn("Qwen cloud API key is not configured; fast chat skips cloud call.");
            return null;
        }
        DeepSeekRequest request = buildHistoryRequest(systemPrompt, userMessage, history);
        return executeWithClient(webClient, request, "Qwen", timeout);
    }

    private DeepSeekRequest buildHistoryRequest(String systemPrompt, String userMessage, List<DeepSeekRequest.Message> history) {
        DeepSeekRequest request = new DeepSeekRequest();
        request.setModel(config.getModel());
        request.setTemperature(config.getTemperature());
        request.setMax_tokens(config.getMaxTokens());
        request.setStream(false);

        java.util.ArrayList<DeepSeekRequest.Message> messages = new java.util.ArrayList<>();
        messages.add(new DeepSeekRequest.Message("system", systemPrompt));
        if (history != null) {
            messages.addAll(history);
        }
        messages.add(new DeepSeekRequest.Message("user", userMessage));
        request.setMessages(messages);
        return request;
    }

    private String generateLocalFallbackResponse(String systemPrompt, String userMessage, List<DeepSeekRequest.Message> history) {
        try {
            DeepSeekRequest localRequest = new DeepSeekRequest();
            localRequest.setModel(config.getLocalModel());
            localRequest.setTemperature(config.getTemperature());
            localRequest.setMax_tokens(config.getLocalMaxTokens());
            localRequest.setStream(false);

            java.util.ArrayList<DeepSeekRequest.Message> localMessages = new java.util.ArrayList<>();
            localMessages.add(new DeepSeekRequest.Message("system", systemPrompt + "\n\n当前云端通用大模型暂时不可用，请作为本地中医微调模型给出保守、结构化、可读的辅助分析；必须提示不能替代医生面诊。"));
            if (history != null) {
                localMessages.addAll(history);
            }
            localMessages.add(new DeepSeekRequest.Message("user", userMessage));
            localRequest.setMessages(localMessages);

            String localResult = executeLocal(localRequest);
            if (localResult != null && !localResult.isBlank()) {
                return "【本地微调模型兜底分析】\n" + localResult.trim() + "\n\n提示：当前云端通用大模型鉴权或网络暂时不可用，以上为本地领域模型临时兜底结果，仅供健康管理参考，不能替代医生面诊。";
            }
        } catch (Exception e) {
            log.warn("Local fallback failed: {}", e.getMessage());
        }
        return null;
    }

    /**
     * 流式聊天 - 返回 SSE Emitter
     * @param systemPrompt 系统提示词
     * @param userMessage 用户消息
     * @param history 对话历史
     * @param recommendedQuestions 推荐题目（流完成后发送）
     * @param currentUser 当前用户（用于保存对话）
     * @param request 原始请求（用于保存对话）
     * @param chatService 对话服务（用于保存对话）
     * @return SSE Emitter
     */
    public SseEmitter streamChat(String systemPrompt, String userMessage, List<DeepSeekRequest.Message> history,
                                 List<AiChatResponse.RecommendedQuestion> recommendedQuestions,
                                 User currentUser, AiChatRequest request, ChatService chatService) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);

        executor.execute(() -> {
            StringBuilder aiContent = new StringBuilder();
            try {
                String effectiveSystemPrompt = systemPrompt;
                String localDraft = generateTcmLocalDraft(systemPrompt, userMessage, history);
                if (localDraft != null && !localDraft.isBlank() && isCloudConfigured()) {
                    effectiveSystemPrompt = buildTcmQwenRefinementSystemPrompt(systemPrompt, localDraft);
                    log.info("TCM stream chat uses local draft + Qwen refinement mode");
                }

                DeepSeekRequest deepSeekRequest = new DeepSeekRequest();
                deepSeekRequest.setModel(config.getModel());
                deepSeekRequest.setTemperature(config.getTemperature());
                deepSeekRequest.setMax_tokens(config.getMaxTokens());
                deepSeekRequest.setStream(true);

                // 构建消息列表
                java.util.ArrayList<DeepSeekRequest.Message> messages = new java.util.ArrayList<>();
                messages.add(new DeepSeekRequest.Message("system", effectiveSystemPrompt));

                // 添加历史消息
                if (history != null) {
                    messages.addAll(history);
                }

                messages.add(new DeepSeekRequest.Message("user", userMessage));
                deepSeekRequest.setMessages(messages);

                // 使用 WebClient 发送 SSE 请求
                Flux<String> sseFlux = webClient.post()
                        .uri("/chat/completions")
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .bodyValue(deepSeekRequest)
                        .retrieve()
                        .onStatus(
                                status -> status.is4xxClientError() || status.is5xxServerError(),
                                response -> response.createException()
                                        .map(ex -> {
                                            log.error("DashScope API error: status={}, body={}", response.statusCode(), ex.getResponseBodyAsString());
                                            return ex;
                                        })
                        )
                        .bodyToFlux(String.class)
                        .retryWhen(buildQwenRetrySpec("Qwen SSE"));

                // 订阅 SSE 事件流
                sseFlux.subscribe(
                        (data) -> {
                            try {
                                // DeepSeek API 返回的 SSE 数据可能是纯 JSON 或带 "data: " 前缀
                                String jsonStr = data;
                                if (data != null && data.startsWith("data: ")) {
                                    jsonStr = data.substring(6).trim();
                                }

                                if (!"[DONE]".equals(jsonStr)) {
                                    try {
                                        var node = objectMapper.readTree(jsonStr);
                                        // 检查是否有 delta.content
                                        if (node.has("choices") &&
                                            node.get("choices").isArray() &&
                                            node.get("choices").size() > 0) {
                                            var delta = node.get("choices").get(0).get("delta");
                                            if (delta != null && delta.has("content")) {
                                                String content = delta.get("content").asText();
                                                if (content != null && !content.isEmpty()) {
                                                    aiContent.append(content);
                                                    emitter.send(SseEmitter.event()
                                                            .name("message")
                                                            .data("{\"content\": \"" + escapeJson(content) + "\"}"));
                                                }
                                            }
                                        }
                                    } catch (Exception e) {
                                        log.warn("Failed to parse SSE data: {}", jsonStr);
                                    }
                                }
                            } catch (Exception e) {
                                log.error("Error sending SSE event: {}", e.getMessage());
                            }
                        },
                        (error) -> {
                            log.error("SSE stream error: {}", error.getMessage(), error);
                            executor.execute(() -> {
                                try {
                                    String fallbackContent = generateLocalFallbackResponse(systemPrompt, userMessage, history);
                                    if (fallbackContent != null && !fallbackContent.isBlank()) {
                                        aiContent.append(fallbackContent);
                                        emitter.send(SseEmitter.event()
                                                .name("message")
                                                .data("{\"content\": \"" + escapeJson(fallbackContent) + "\"}"));
                                        if (recommendedQuestions != null && !recommendedQuestions.isEmpty()) {
                                            String questionsJson = recommendedQuestions.stream()
                                                    .map(q -> String.format("{\"id\":%d,\"score\":%.4f}", q.getId(), q.getScore()))
                                                    .collect(java.util.stream.Collectors.joining(",", "[", "]"));
                                            emitter.send(SseEmitter.event()
                                                    .name("questions")
                                                    .data("{\"recommendedQuestions\": " + questionsJson + "}"));
                                        }
                                        emitter.send(SseEmitter.event()
                                                .name("done")
                                                .data("{\"done\": true}"));
                                        emitter.complete();
                                        if (currentUser != null && chatService != null) {
                                            autoSaveStreamConversation(currentUser.getId(), request, aiContent.toString(), recommendedQuestions, chatService);
                                        }
                                        return;
                                    }

                                    emitter.send(SseEmitter.event()
                                            .name("error")
                                            .data("{\"error\": \"" + escapeJson(error.getMessage() != null ? error.getMessage() : "未知错误") + "\"}"));
                                    emitter.completeWithError(error);
                                } catch (Exception e) {
                                    log.error("Error sending fallback/error event: {}", e.getMessage(), e);
                                    emitter.completeWithError(e);
                                }
                            });
                        },
                        () -> {
                            // 流完成时，先发送推荐题目，再发送完成事件，最后保存对话
                            try {
                                if (recommendedQuestions != null && !recommendedQuestions.isEmpty()) {
                                    String questionsJson = recommendedQuestions.stream()
                                            .map(q -> String.format("{\"id\":%d,\"score\":%.4f}", q.getId(), q.getScore()))
                                            .collect(java.util.stream.Collectors.joining(",", "[", "]"));
                                    emitter.send(SseEmitter.event()
                                            .name("questions")
                                            .data("{\"recommendedQuestions\": " + questionsJson + "}"));
                                }
                                emitter.send(SseEmitter.event()
                                        .name("done")
                                        .data("{\"done\": true}"));
                                emitter.complete();

                                // 保存对话到数据库
                                if (currentUser != null && chatService != null) {
                                    autoSaveStreamConversation(currentUser.getId(), request, aiContent.toString(), recommendedQuestions, chatService);
                                }
                            } catch (Exception e) {
                                log.error("Error sending completion or questions event: {}", e.getMessage());
                                try {
                                    emitter.complete();
                                } catch (Exception ex) {
                                    log.error("Error completing emitter: {}", ex.getMessage());
                                }
                            }
                        }
                );

            } catch (Exception e) {
                log.error("Stream chat error: {}", e.getMessage(), e);
                emitter.completeWithError(e);
            }
        });

        emitter.onCompletion(() -> log.debug("Stream chat completed"));
        emitter.onTimeout(emitter::complete);
        emitter.onError(e -> log.error("Stream chat error: {}", e.getMessage()));

        return emitter;
    }

    /**
     * 自动保存流式对话到数据库
     */
    private void autoSaveStreamConversation(Long userId, AiChatRequest request, String aiContent,
                                           List<AiChatResponse.RecommendedQuestion> recommendedQuestions,
                                           ChatService chatService) {
        try {
            // 构建消息列表：历史消息 + 用户新消息 + AI回复
            java.util.ArrayList<SaveConversationRequest.MessageDto> messages = new java.util.ArrayList<>();

            // 添加历史消息
            if (request.getHistory() != null) {
                for (AiChatRequest.ChatMessage chatMsg : request.getHistory()) {
                    messages.add(SaveConversationRequest.MessageDto.builder()
                            .role(chatMsg.getRole())
                            .content(chatMsg.getContent())
                            .build());
                }
            }

            // 添加用户消息
            messages.add(SaveConversationRequest.MessageDto.builder()
                    .role("user")
                    .content(request.getMessage())
                    .build());

            // 添加AI回复
            messages.add(SaveConversationRequest.MessageDto.builder()
                    .role("assistant")
                    .content(aiContent)
                    .recommendedQuestions(recommendedQuestions != null ?
                            recommendedQuestions.stream().map(q ->
                                    SaveConversationRequest.RecommendedQuestion.builder()
                                            .questionId(q.getId())
                                            .score(q.getScore())
                                            .build()
                            ).toList() : null)
                    .build());

            // 构建保存请求
            SaveConversationRequest saveRequest = SaveConversationRequest.builder()
                    .id(request.getConversationId())
                    .title(request.getTitle())
                    .messages(messages)
                    .build();

            // 保存对话
            chatService.saveConversation(userId, saveRequest);
            log.info("流式对话自动保存成功: userId={}, conversationId={}", userId, request.getConversationId());
        } catch (Exception e) {
            log.error("流式对话自动保存失败: {}", e.getMessage(), e);
        }
    }

    /**
     * JSON 字符串转对话历史列表
     */
    public List<DeepSeekRequest.Message> parseHistory(List<AiChatRequest.ChatMessage> history) {
        if (history == null) return null;
        return history.stream()
                .map(m -> new DeepSeekRequest.Message(m.getRole(), m.getContent()))
                .toList();
    }

    private String escapeJson(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\")
                   .replace("\"", "\\\"")
                   .replace("\n", "\\n")
                   .replace("\r", "\\r")
                   .replace("\t", "\\t");
    }
}

