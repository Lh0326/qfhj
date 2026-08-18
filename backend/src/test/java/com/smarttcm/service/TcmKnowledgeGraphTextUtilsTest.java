package com.smarttcm.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TcmKnowledgeGraphTextUtilsTest {

    @Test
    void extractsDistinctTcmTermsFromMixedKnowledgeFields() {
        List<String> terms = TcmKnowledgeGraphTextUtils.extractTerms(
                "陈皮：理气健脾，燥湿化痰；薄荷-疏散风热、清利头目",
                "中药学 / 方剂学",
                "理气药",
                "陈皮"
        );

        assertTrue(terms.contains("陈皮"));
        assertTrue(terms.contains("理气健脾"));
        assertTrue(terms.contains("燥湿化痰"));
        assertTrue(terms.contains("薄荷"));
        assertTrue(terms.contains("中药学"));
        assertTrue(terms.size() <= 12);
        assertEquals(terms.size(), terms.stream().distinct().count());
    }

    @Test
    void classifiesCommonTcmTermTypesForGraphBadges() {
        assertEquals("中药", TcmKnowledgeGraphTextUtils.classifyTerm("陈皮"));
        assertEquals("方剂", TcmKnowledgeGraphTextUtils.classifyTerm("四君子汤"));
        assertEquals("功效", TcmKnowledgeGraphTextUtils.classifyTerm("理气健脾"));
        assertEquals("分类", TcmKnowledgeGraphTextUtils.classifyTerm("中药学"));
    }
}
