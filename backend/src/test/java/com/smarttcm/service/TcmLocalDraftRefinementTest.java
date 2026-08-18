package com.smarttcm.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;

class TcmLocalDraftRefinementTest {

    @Test
    void localDraftPromptLimitsModelToShortEvidenceOnlyAndPreventsFinalDiagnosis() {
        String prompt = DeepSeekService.buildTcmLocalDraftSystemPrompt(DeepSeekService.TCM_DIAGNOSIS_SYSTEM_PROMPT);

        assertThat(prompt).contains("本地中医微调模型");
        assertThat(prompt).contains("只输出可供 Qwen 参考的短草稿");
        assertThat(prompt).contains("禁止给出最终诊断");
        assertThat(prompt).contains("不要输出方药剂量");
        assertThat(prompt).contains("120字以内");
        assertThat(prompt).contains("证据线索");
    }

    @Test
    void qwenRefinementPromptTreatsLocalDraftAsLowTrustReference() {
        String prompt = DeepSeekService.buildTcmQwenRefinementSystemPrompt(
                DeepSeekService.TCM_DIAGNOSIS_SYSTEM_PROMPT,
                "本地草稿：肝郁脾虚，建议逍遥散"
        );

        assertThat(prompt).contains("本地微调模型草稿只作为低置信度参考");
        assertThat(prompt).contains("如草稿与用户原始症状");
        assertThat(prompt).contains("必须忽略或纠正草稿");
        assertThat(prompt).contains("不要在最终回答中说明模型链路");
        assertThat(prompt).contains("本地草稿：肝郁脾虚");
    }

    @Test
    void lowQualityLocalDraftIsRejectedBeforeQwenSeesIt() {
        assertThat(DeepSeekService.isUsableTcmLocalDraft(null)).isFalse();
        assertThat(DeepSeekService.isUsableTcmLocalDraft("太短")).isFalse();
        assertThat(DeepSeekService.isUsableTcmLocalDraft("<think>内部推理</think> 肝郁脾虚" )).isFalse();
        assertThat(DeepSeekService.isUsableTcmLocalDraft("善太息、胁胀与情志抑郁可作为肝气郁结线索；若伴纳差便溏，可兼脾虚，需继续询问舌脉、睡眠、二便。" )).isTrue();
    }

    @Test
    void retryPolicyRetriesOnlyTemporaryProviderFailures() {
        assertThat(DeepSeekService.isRetryableProviderFailure(new TimeoutException("timeout"))).isTrue();
        assertThat(DeepSeekService.isRetryableProviderFailure(new RuntimeException("connection reset by peer"))).isTrue();
        assertThat(DeepSeekService.isRetryableProviderFailure(providerException(429))).isTrue();
        assertThat(DeepSeekService.isRetryableProviderFailure(providerException(500))).isTrue();

        assertThat(DeepSeekService.isRetryableProviderFailure(providerException(401))).isFalse();
        assertThat(DeepSeekService.isRetryableProviderFailure(providerException(400))).isFalse();
        assertThat(DeepSeekService.isRetryableProviderFailure(new IllegalArgumentException("bad request"))).isFalse();
    }

    private WebClientResponseException providerException(int status) {
        return WebClientResponseException.create(
                status,
                "provider error",
                null,
                "{}".getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
        );
    }
}
