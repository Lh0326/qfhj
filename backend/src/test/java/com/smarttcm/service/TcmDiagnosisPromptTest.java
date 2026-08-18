package com.smarttcm.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TcmDiagnosisPromptTest {

    @Test
    void diagnosisPromptRequiresFourDiagnosticsEvidenceChainAndSafetyTriage() {
        String prompt = DeepSeekService.TCM_DIAGNOSIS_SYSTEM_PROMPT;

        assertThat(prompt).contains("四诊合参");
        assertThat(prompt).contains("望诊", "闻诊", "问诊", "切诊");
        assertThat(prompt).contains("舌质", "舌苔", "脉象");
        assertThat(prompt).contains("十问歌");
        assertThat(prompt).contains("主病", "兼病", "病位", "病性");
        assertThat(prompt).contains("证据链");
        assertThat(prompt).contains("鉴别辨证");
        assertThat(prompt).contains("危险信号", "及时就医");
    }
}
