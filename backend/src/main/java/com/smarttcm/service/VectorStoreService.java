package com.smarttcm.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class VectorStoreService {

    private static final Logger logger = LoggerFactory.getLogger(VectorStoreService.class);

    @Value("${rag.embedding-dimension:1024}")
    private int embeddingDimension;

    @Value("${rag.max-results:5}")
    private int maxResults;

    @Value("${rag.index-type:FLAT}")
    private String indexType;

    private final EmbeddingService embeddingService;

    private final Map<Integer, float[]> index = new ConcurrentHashMap<>();
    private final Map<Integer, String> idToText = new ConcurrentHashMap<>();
    private final Map<String, Integer> textToId = new ConcurrentHashMap<>();
    private int nextId = 0;

    @Value("${app.file.storage-path:downloads}")
    private String storagePath;

    private static final String INDEX_SUBDIR = "rag";
    private static final String INDEX_FILE = "vector_index.dat";

    public VectorStoreService(EmbeddingService embeddingService) {
        this.embeddingService = embeddingService;
    }

    @PostConstruct
    public void init() {
        loadIndex();
    }

    public String addDocument(String text) {
        try {
            List<Float> embedding = embeddingService.embedText(text);
            return addDocumentWithEmbedding(text, embedding);
        } catch (Exception e) {
            logger.error("添加文档失败: {}", e.getMessage());
            throw new RuntimeException("添加文档失败: " + e.getMessage(), e);
        }
    }

    public String addDocuments(List<String> texts) {
        try {
            List<List<Float>> embeddings = embeddingService.embedTexts(texts);
            List<String> ids = new ArrayList<>();
            
            for (int i = 0; i < texts.size(); i++) {
                String id = addDocumentWithEmbedding(texts.get(i), embeddings.get(i));
                ids.add(id);
            }
            
            saveIndex();
            logger.info("成功添加 {} 个文档", texts.size());
            return String.join(",", ids);
        } catch (Exception e) {
            logger.error("批量添加文档失败: {}", e.getMessage());
            throw new RuntimeException("批量添加文档失败: " + e.getMessage(), e);
        }
    }

    private String addDocumentWithEmbedding(String text, List<Float> embedding) {
        if (embedding.size() != embeddingDimension) {
            throw new IllegalArgumentException(
                String.format("向量维度不匹配: 期望 %d, 实际 %d", embeddingDimension, embedding.size()));
        }

        int id = nextId++;
        float[] vector = new float[embeddingDimension];
        for (int i = 0; i < embeddingDimension; i++) {
            vector[i] = embedding.get(i);
        }

        index.put(id, vector);
        idToText.put(id, text);
        textToId.put(text, id);

        logger.debug("添加文档 ID: {}, 文本长度: {} 字符", id, text.length());
        saveIndex();

        return String.valueOf(id);
    }

    public List<SearchResult> search(String query, int topK) {
        try {
            List<Float> queryEmbedding = embeddingService.embedText(query);
            return searchWithEmbedding(queryEmbedding, topK);
        } catch (Exception e) {
            logger.error("搜索失败: {}", e.getMessage());
            throw new RuntimeException("搜索失败: " + e.getMessage(), e);
        }
    }

    public List<SearchResult> searchWithEmbedding(List<Float> queryEmbedding, int topK) {
        if (index.isEmpty()) {
            return Collections.emptyList();
        }

        float[] queryVector = new float[embeddingDimension];
        for (int i = 0; i < embeddingDimension; i++) {
            queryVector[i] = queryEmbedding.get(i);
        }

        List<ScoreEntry> scores = new ArrayList<>();
        for (Map.Entry<Integer, float[]> entry : index.entrySet()) {
            float similarity = cosineSimilarity(queryVector, entry.getValue());
            scores.add(new ScoreEntry(entry.getKey(), similarity));
        }

        scores.sort((a, b) -> Float.compare(b.similarity, a.similarity));

        int limit = Math.min(topK > 0 ? topK : maxResults, scores.size());
        List<SearchResult> results = new ArrayList<>();
        for (int i = 0; i < limit; i++) {
            ScoreEntry entry = scores.get(i);
            results.add(new SearchResult(
                String.valueOf(entry.id),
                idToText.get(entry.id),
                entry.similarity
            ));
        }

        return results;
    }

    private float cosineSimilarity(float[] a, float[] b) {
        if (a.length != b.length) {
            throw new IllegalArgumentException("向量维度不一致");
        }

        float dotProduct = 0.0f;
        float normA = 0.0f;
        float normB = 0.0f;

        for (int i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        float denominator = (float) (Math.sqrt(normA) * Math.sqrt(normB));
        if (denominator == 0) {
            return 0.0f;
        }

        return dotProduct / denominator;
    }

    public boolean deleteDocument(String id) {
        try {
            int intId = Integer.parseInt(id);
            String text = idToText.remove(intId);
            float[] vector = index.remove(intId);
            
            if (text != null) {
                textToId.remove(text);
            }
            
            boolean deleted = vector != null;
            if (deleted) {
                saveIndex();
                logger.info("删除文档 ID: {}", id);
            }
            return deleted;
        } catch (NumberFormatException e) {
            logger.error("无效的文档 ID: {}", id);
            return false;
        }
    }

    public void clearIndex() {
        index.clear();
        idToText.clear();
        textToId.clear();
        nextId = 0;
        deleteIndexFile();
        logger.info("索引已清空");
    }

    public int getDocumentCount() {
        return index.size();
    }

    private Path getIndexPath() {
        Path dir = Paths.get(storagePath, INDEX_SUBDIR);
        if (!Files.exists(dir)) {
            try {
                Files.createDirectories(dir);
            } catch (IOException e) {
                throw new RuntimeException("无法创建索引目录: " + dir, e);
            }
        }
        return dir.resolve(INDEX_FILE);
    }

    private void saveIndex() {
        try {
            Path path = getIndexPath();
            try (ObjectOutputStream oos = new ObjectOutputStream(
                    new BufferedOutputStream(Files.newOutputStream(path)))) {
                oos.writeObject(nextId);
                oos.writeInt(index.size());
                for (Map.Entry<Integer, float[]> entry : index.entrySet()) {
                    oos.writeInt(entry.getKey());
                    oos.writeObject(entry.getValue());
                    oos.writeObject(idToText.get(entry.getKey()));
                }
            }
            logger.debug("索引已保存到: {}", path.toAbsolutePath());
        } catch (IOException e) {
            logger.error("保存索引失败: {}", e.getMessage());
        }
    }

    private void loadIndex() {
        Path path = getIndexPath();
        if (!Files.exists(path)) {
            logger.info("索引文件不存在，从空索引开始: {}", path.toAbsolutePath());
            return;
        }

        try (ObjectInputStream ois = new ObjectInputStream(
                new BufferedInputStream(Files.newInputStream(path)))) {
            nextId = (int) ois.readObject();
            int size = ois.readInt();

            for (int i = 0; i < size; i++) {
                int id = ois.readInt();
                float[] vector = (float[]) ois.readObject();
                String text = (String) ois.readObject();

                index.put(id, vector);
                idToText.put(id, text);
                textToId.put(text, id);
            }

            logger.info("索引加载完成，共 {} 个文档，路径: {}", size, path.toAbsolutePath());
        } catch (Exception e) {
            logger.error("加载索引失败: {}", e.getMessage());
        }
    }

    private void deleteIndexFile() {
        try {
            Files.deleteIfExists(getIndexPath());
        } catch (IOException e) {
            logger.error("删除索引文件失败: {}", e.getMessage());
        }
    }

    public static class SearchResult {
        private final String id;
        private final String text;
        private final float score;

        public SearchResult(String id, String text, float score) {
            this.id = id;
            this.text = text;
            this.score = score;
        }

        public String getId() { return id; }
        public String getText() { return text; }
        public float getScore() { return score; }
    }

    private static class ScoreEntry {
        final int id;
        final float similarity;

        ScoreEntry(int id, float similarity) {
            this.id = id;
            this.similarity = similarity;
        }
    }
}
