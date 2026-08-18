package com.smarttcm.service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 中医知识图谱文本清洗工具。
 * 只做轻量、可解释的关键词切分，避免引入额外 NLP 依赖影响本地部署。
 */
public final class TcmKnowledgeGraphTextUtils {

    private static final Pattern SPLIT_PATTERN = Pattern.compile("[，,；;、/\\n\\r\\t|]+|(?:：|:)|(?: - )|(?:—)|(?:-)");
    private static final Set<String> HERBS = Set.of(
            "陈皮", "薄荷", "合欢花", "甘草", "黄芪", "当归", "茯苓", "白术", "人参", "党参",
            "柴胡", "桂枝", "麻黄", "芍药", "半夏", "生姜", "大枣", "黄连", "黄芩", "金银花"
    );

    private TcmKnowledgeGraphTextUtils() {
    }

    public static List<String> extractTerms(String... texts) {
        LinkedHashSet<String> terms = new LinkedHashSet<>();
        if (texts == null) return List.of();

        for (String text : texts) {
            if (text == null || text.isBlank()) continue;
            String cleaned = text
                    .replaceAll("\\[图片:[^\\]]+\\]", " ")
                    .replaceAll("[（）()【】\\[\\]《》<>]", " ")
                    .replaceAll("\\s+", " ")
                    .trim();
            for (String part : SPLIT_PATTERN.split(cleaned)) {
                addIfUseful(terms, part);
                if (terms.size() >= 12) return new ArrayList<>(terms);
            }
        }
        return new ArrayList<>(terms);
    }

    public static String classifyTerm(String term) {
        if (term == null || term.isBlank()) return "概念";
        String value = term.trim();
        if (HERBS.contains(value) || value.endsWith("草") || value.endsWith("花") || value.endsWith("皮") || value.endsWith("参")) return "中药";
        if (value.endsWith("汤") || value.endsWith("散") || value.endsWith("丸") || value.endsWith("饮") || value.endsWith("方")) return "方剂";
        if (value.endsWith("学") || value.contains("分类") || value.contains("项目")) return "分类";
        if (value.contains("经") || value.contains("穴")) return "经络穴位";
        if (value.contains("健脾") || value.contains("化痰") || value.contains("清热") || value.contains("理气") || value.contains("安神") || value.contains("祛湿")) return "功效";
        return "概念";
    }

    private static void addIfUseful(Set<String> terms, String raw) {
        if (raw == null) return;
        String term = raw.replaceAll("^[0-9.、 ]+", "").trim();
        if (term.length() < 2 || term.length() > 24) return;
        if (term.matches("^[A-D]$")) return;
        terms.add(term);
    }
}
