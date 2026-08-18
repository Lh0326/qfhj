package com.smarttcm.controller;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SkinDetectionControllerTest {

    @Test
    void lowRiskSegmentationReturnsConservativeHealthyAnalysis() {
        String[] analysis = SkinDetectionController.buildLowRiskAnalysis(0.0, 0.0);

        assertThat(analysis[0]).contains("未见明确皮肤病变");
        assertThat(analysis[0]).doesNotContain("证型");
        assertThat(analysis[0]).doesNotContain("方剂");
        assertThat(analysis[1]).contains("未识别到明确病变区域");
        assertThat(analysis[1]).doesNotContain("湿疹");
    }

    @Test
    void significantSegmentationDoesNotAllowNoAbnormalConclusion() {
        String contradictory = "经仔细观察，图片中未见明显异常皮损，暂不支持具体疾病诊断。";

        assertThat(SkinDetectionController.isContradictoryNoLesionAnalysis(12.5, contradictory)).isTrue();

        String[] fallback = SkinDetectionController.buildSegmentationConsistentAnalysis(12.5, 0.86);
        assertThat(fallback[0]).contains("分割模型已标出");
        assertThat(fallback[0]).contains("12.5%");
        assertThat(fallback[0]).doesNotContain("未见明显异常皮损");
        assertThat(fallback[1]).contains("不应判定为无异常");
    }
}
