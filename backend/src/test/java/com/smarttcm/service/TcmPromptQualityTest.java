package com.smarttcm.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TcmPromptQualityTest {

    @Test
    void tcmPromptShouldRequireProfessionalTcmReasoningAndRichAnswer() {
        String prompt = DeepSeekService.TCM_DIAGNOSIS_SYSTEM_PROMPT;

        assertThat(prompt).contains("中医味");
        assertThat(prompt).contains("700-1200字");
        assertThat(prompt).contains("四诊资料归纳");
        assertThat(prompt).contains("病位、病性、正邪盛衰、气血津液、升降出入、寒热虚实");
        assertThat(prompt).contains("倾向性辨证");
        assertThat(prompt).contains("最可能的主证、可能兼证和一个鉴别证型");
        assertThat(prompt).contains("不要因为本地草稿很短就缩短最终回答");
    }

    @Test
    void qwenRefinementPromptShouldTreatLocalDraftAsLowTrust() {
        String prompt = DeepSeekService.buildTcmQwenRefinementSystemPrompt(
                DeepSeekService.TCM_DIAGNOSIS_SYSTEM_PROMPT,
                "证据线索：口苦、善太息；可能倾向：肝胆气机不舒。"
        );

        assertThat(prompt).contains("低置信度参考");
        assertThat(prompt).contains("最终回答必须以用户原始描述和四诊合参为准");
        assertThat(prompt).contains("不要为了迎合草稿而降低专业性");
        assertThat(prompt).contains("Qwen plus 的专业分析为准");
    }
}
