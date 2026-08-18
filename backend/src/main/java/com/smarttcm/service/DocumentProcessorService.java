package com.smarttcm.service;

import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class DocumentProcessorService {

    private static final Logger logger = LoggerFactory.getLogger(DocumentProcessorService.class);

    @Value("${rag.chunk-size:500}")
    private int chunkSize;

    @Value("${rag.chunk-overlap:50}")
    private int chunkOverlap;

    private static final Pattern CHINESE_SENTENCE_PATTERN = 
        Pattern.compile("[。！？；\n]+");

    public List<String> chunkText(String text) {
        if (text == null || text.trim().isEmpty()) {
            return new ArrayList<>();
        }

        text = cleanText(text);
        List<String> chunks = new ArrayList<>();
        
        String[] sentences = CHINESE_SENTENCE_PATTERN.split(text);
        StringBuilder currentChunk = new StringBuilder();

        for (String sentence : sentences) {
            sentence = sentence.trim();
            if (sentence.isEmpty()) {
                continue;
            }

            if (currentChunk.length() + sentence.length() <= chunkSize) {
                currentChunk.append(sentence).append("。");
            } else {
                if (currentChunk.length() > 0) {
                    chunks.add(currentChunk.toString());
                    
                    String overlapText = currentChunk.toString();
                    int overlapStart = Math.max(0, overlapText.length() - chunkOverlap);
                    currentChunk = new StringBuilder(
                        overlapText.substring(overlapStart));
                }
                
                if (sentence.length() > chunkSize) {
                    List<String> subChunks = splitLongSentence(sentence);
                    for (int i = 0; i < subChunks.size(); i++) {
                        chunks.add(subChunks.get(i));
                        if (i < subChunks.size() - 1) {
                            currentChunk = new StringBuilder(subChunks.get(i));
                        }
                    }
                } else {
                    currentChunk.append(sentence).append("。");
                }
            }
        }

        if (currentChunk.length() > 0) {
            chunks.add(currentChunk.toString());
        }

        logger.info("文本分块完成: 原始长度 {} 字符, 分块数量 {} 个", 
            text.length(), chunks.size());
        return chunks;
    }

    public String extractTextFromFile(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename();
        if (filename == null) {
            throw new IOException("文件名不能为空");
        }

        String extension = filename.toLowerCase();
        if (extension.endsWith(".txt")) {
            return extractTextFromTxt(file);
        } else if (extension.endsWith(".md")) {
            return extractTextFromMarkdown(file);
        } else if (extension.endsWith(".html") || extension.endsWith(".htm")) {
            return extractTextFromHtml(file);
        } else if (extension.endsWith(".doc") || extension.endsWith(".docx")) {
            return extractTextFromDoc(file);
        } else {
            throw new IOException("不支持的文件格式: " + extension);
        }
    }

    private String extractTextFromTxt(MultipartFile file) throws IOException {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            return reader.lines().collect(Collectors.joining("\n"));
        }
    }

    private String extractTextFromMarkdown(MultipartFile file) throws IOException {
        String content = extractTextFromTxt(file);
        content = content.replaceAll("#+\\s+", "");
        content = content.replaceAll("\\[([^\\]]+)\\]\\([^)]+\\)", "$1");
        content = content.replaceAll("[*_`~]+", "");
        return content;
    }

    private String extractTextFromHtml(MultipartFile file) throws IOException {
        String html = extractTextFromTxt(file);
        return Jsoup.clean(html, Safelist.none())
                    .replaceAll("\\s+", " ")
                    .trim();
    }

    private String extractTextFromDoc(MultipartFile file) {
        throw new UnsupportedOperationException(
            "DOC/DOCX 格式需要额外依赖 (如 Apache POI)，请使用 TXT 或 Markdown 格式");
    }

    private List<String> splitLongSentence(String text) {
        List<String> chunks = new ArrayList<>();
        int start = 0;
        
        while (start < text.length()) {
            int end = Math.min(start + chunkSize, text.length());
            if (end < text.length()) {
                int lastComma = text.lastIndexOf('，', start + chunkSize);
                int lastPeriod = text.lastIndexOf('。', start + chunkSize);
                int splitPoint = Math.max(lastComma, lastPeriod);
                
                if (splitPoint > start + chunkSize / 2) {
                    end = splitPoint + 1;
                }
            }
            
            chunks.add(text.substring(start, end).trim());
            start = end;
        }
        
        return chunks;
    }

    private String cleanText(String text) {
        text = text.replaceAll("[\\x00-\\x1F\\x7F]", "");
        text = text.replaceAll("\\s+", " ");
        text = text.replaceAll("\\n{3,}", "\n\n");
        return text.trim();
    }
}
