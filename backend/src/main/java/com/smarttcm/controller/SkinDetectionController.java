package com.smarttcm.controller;

import com.smarttcm.entity.SkinDetectionRecord;
import com.smarttcm.entity.User;
import com.smarttcm.repository.SkinDetectionRecordRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

/**
 * 皮肤病检测控制器
 * 上传皮肤图片 → Python分割服务 → Qwen-VL视觉模型分析 → 返回结果
 */
@RestController
@RequestMapping("/skin-detection")
@Tag(name = "皮肤病检测", description = "皮肤病检测与分割分析接口")
@SecurityRequirement(name = "Bearer Authentication")
public class SkinDetectionController {

    private static final Logger log = LoggerFactory.getLogger(SkinDetectionController.class);
    private static final long MAX_UPLOAD_BYTES = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    @Value("${app.skin-detection.python-service-url:http://127.0.0.1:5000}")
    private String pythonServiceUrl;

    @Value("${deepseek.api-key}")
    private String apiKey;

    @Value("${deepseek.base-url}")
    private String baseUrl;

    @Autowired
    private SkinDetectionRecordRepository detectionRecordRepository;

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * 分析皮肤图片
     */
    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "分析皮肤图片", description = "上传皮肤图片进行疾病检测分析")
    public ResponseEntity<?> analyzeSkinImage(
            @AuthenticationPrincipal User currentUser,
            @RequestParam("image") MultipartFile image) {

        log.info("Skin detection request from user: {}, file: {}, size: {}KB",
                currentUser != null ? currentUser.getUsername() : "anonymous",
                image.getOriginalFilename(),
                image.getSize() / 1024);

        if (image.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "请上传图片文件"
            ));
        }
        if (image.getSize() > MAX_UPLOAD_BYTES) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "message", "图片大小不能超过 10MB"
            ));
        }

        try {
            byte[] imageBytes = image.getBytes();
            String mimeType = image.getContentType() != null ? image.getContentType() : "";
            if (!ALLOWED_IMAGE_TYPES.contains(mimeType) || !hasValidImageMagic(imageBytes, mimeType)) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false, "message", "仅支持 JPG、PNG、WEBP 格式的真实图片文件"
                ));
            }
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);

            // Step 1: Call Python segmentation service
            HttpHeaders segHeaders = new HttpHeaders();
            segHeaders.setContentType(MediaType.MULTIPART_FORM_DATA);

            ByteArrayResource fileResource = new ByteArrayResource(imageBytes) {
                @Override
                public String getFilename() {
                    return "skin-upload" + extensionFromMimeType(mimeType);
                }
            };

            MultiValueMap<String, Object> segBody = new LinkedMultiValueMap<>();
            segBody.add("file", fileResource);

            HttpEntity<MultiValueMap<String, Object>> segRequest = new HttpEntity<>(segBody, segHeaders);

            ResponseEntity<String> segResponse = restTemplate.exchange(
                    pythonServiceUrl + "/segment",
                    HttpMethod.POST, segRequest, String.class
            );

            if (!segResponse.getStatusCode().is2xxSuccessful() || segResponse.getBody() == null) {
                log.error("Python service returned: {}", segResponse.getStatusCode());
                return ResponseEntity.status(502).body(Map.of(
                        "success", false, "message", "分割服务调用失败"
                ));
            }

            JsonNode segResult = objectMapper.readTree(segResponse.getBody());
            double lesionPercentage = segResult.path("lesion_percentage").asDouble(0);
            double confidenceScore = segResult.path("confidence_score").asDouble(0);
            String overlayBase64 = segResult.path("overlay_base64").asText("");
            double inferenceMs = segResult.path("inference_time_ms").asDouble(0);

            log.info("Segmentation: lesion={}%, confidence={}, time={}ms",
                    String.format("%.1f", lesionPercentage),
                    String.format("%.3f", confidenceScore),
                    String.format("%.0f", inferenceMs));

            // Step 2: Check if image is suitable for skin detection
            // If lesion area is 0% and confidence is 0, the image may not be a skin image at all
            String diseaseLabel;
            String tcmAnalysis;
            String westernDiagnosis;

            diseaseLabel = getDiseaseLabel(lesionPercentage);

            try {
                if (isLowRiskSegmentation(lesionPercentage, confidenceScore)) {
                    diseaseLabel = "未检测到明显皮肤病变";
                    String[] analysis = buildLowRiskAnalysis(lesionPercentage, confidenceScore);
                    tcmAnalysis = analysis[0];
                    westernDiagnosis = analysis[1];
                } else {
                    String[] analysis = callQwenVLForAnalysis(base64Image, mimeType, overlayBase64, lesionPercentage, confidenceScore);
                    tcmAnalysis = analysis[0];
                    westernDiagnosis = analysis[1];
                }
            } catch (Exception e) {
                log.warn("Qwen-VL analysis failed: {}", e.getMessage());
                if (lesionPercentage == 0 && confidenceScore == 0) {
                    diseaseLabel = "未检测到皮肤病变";
                    tcmAnalysis = "图片中未检测到明显的皮肤病变区域。可能原因：图片为正常皮肤、非皮肤部位照片，或图片清晰度不足。如您的皮肤有不适症状，建议前往医院皮肤科进行专业检查。";
                    westernDiagnosis = "分割模型未在图片中识别到病变区域，且AI视觉分析暂时不可用。部分早期或轻微病变可能需要皮肤镜等专业设备才能观察，建议有疑虑时前往正规医院皮肤科就诊。";
                } else {
                    tcmAnalysis = "检测到皮肤病变区域占比" + String.format("%.1f", lesionPercentage) + "%。AI视觉分析暂时不可用，建议到医院皮肤科就诊获取专业诊断。";
                    westernDiagnosis = "病变区域占比" + String.format("%.1f", lesionPercentage) + "%，置信度" + String.format("%.1f", confidenceScore * 100) + "%。建议结合临床查体进一步明确诊断。";
                }
            }

            // Build response
            String segmentationMapUrl = overlayBase64.isEmpty() ? null :
                    "data:image/png;base64," + overlayBase64;

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("message", "检测完成");
            response.put("diseaseLabel", diseaseLabel);
            response.put("confidenceScore", lesionPercentage > 0 ? confidenceScore : -1.0);
            response.put("confidenceLabel", lesionPercentage > 0
                    ? String.format("%.1f%%", confidenceScore * 100)
                    : "未检测到病变");
            response.put("segmentationMapUrl", segmentationMapUrl);
            response.put("tcmAnalysis", tcmAnalysis);
            response.put("westernDiagnosis", westernDiagnosis);

            // Save record
            if (currentUser != null) {
                try {
                    SkinDetectionRecord record = SkinDetectionRecord.builder()
                            .userId(currentUser.getId())
                            .imageUrl(image.getOriginalFilename())
                            .resultJson(objectMapper.writeValueAsString(Map.of(
                                    "lesion_percentage", lesionPercentage,
                                    "confidence_score", confidenceScore,
                                    "inference_time_ms", inferenceMs
                            )))
                            .diseaseLabel(diseaseLabel)
                            .confidenceScore(confidenceScore)
                            .tcmAnalysis(tcmAnalysis)
                            .westernDiagnosis(westernDiagnosis)
                            .build();
                    detectionRecordRepository.save(record);
                } catch (Exception e) {
                    log.warn("保存检测记录失败: {}", e.getMessage());
                }
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Skin detection failed", e);
            return ResponseEntity.status(500).body(Map.of(
                    "success", false, "message", "检测服务暂时不可用，请稍后重试或前往正规医院皮肤科就诊"
            ));
        }
    }

    private static boolean hasValidImageMagic(byte[] bytes, String mimeType) {
        if (bytes == null || bytes.length < 12) {
            return false;
        }
        if ("image/jpeg".equals(mimeType)) {
            return (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[bytes.length - 2] & 0xFF) == 0xFF && (bytes[bytes.length - 1] & 0xFF) == 0xD9;
        }
        if ("image/png".equals(mimeType)) {
            return (bytes[0] & 0xFF) == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47;
        }
        if ("image/webp".equals(mimeType)) {
            return bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46
                    && bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50;
        }
        return false;
    }

    private static String extensionFromMimeType(String mimeType) {
        return switch (mimeType) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
    }

    /**
     * Call Qwen-VL vision-language model to analyze the skin image
     * Uses DashScope OpenAI-compatible API with qwen-vl-plus model
     */
    static boolean isLowRiskSegmentation(double lesionPct, double confidence) {
        return lesionPct < 2.0 || (lesionPct < 3.0 && confidence < 0.70);
    }

    static String[] buildLowRiskAnalysis(double lesionPct, double confidence) {
        return new String[]{
                "经智能分割模型分析，当前图片中未见明确皮肤病变区域，整体表现符合健康皮肤特征。如您的皮肤有瘙痒、红肿、脱屑、不明斑块等不适症状，建议前往正规医院皮肤科面诊，由专业医师结合望闻问切综合判断。",
                "智能分割模型在当前图片中未识别到明确病变区域。结合图片整体表现，暂不支持判定为具体皮肤疾病。如自觉皮肤异常或症状持续，建议到正规医院皮肤科行进一步检查。"
        };
    }

    private String[] callQwenVLForAnalysis(String base64Image, String mimeType, String overlayBase64,
                                            double lesionPct, double confidence) throws Exception {
        // Build multimodal message content: original image + segmentation overlay + text
        Map<String, Object> imageContent = Map.of(
                "type", "image_url",
                "image_url", Map.of("url", "data:" + mimeType + ";base64," + base64Image)
        );

        List<Object> messageContent = new ArrayList<>();
        messageContent.add(imageContent);
        if (overlayBase64 != null && !overlayBase64.isBlank()) {
            messageContent.add(Map.of(
                    "type", "image_url",
                    "image_url", Map.of("url", "data:image/png;base64," + overlayBase64)
            ));
        }

        String promptText = String.format(
                "你是一位谨慎的中医皮肤科辅助分析专家。请同时观察两张图：第一张是原始皮肤图片，第二张如存在则是分割模型叠加图，其中红色区域为模型标出的疑似病变区域。" +
                "当前智能分割模型结果为：病变区域占比%.1f%%，置信度%.1f%%。\n" +
                "一致性原则：如果分割模型已标出明确病变区域（占比不低于2%%），则不能写\"未见明显异常皮损\"、\"未见明确皮肤病变\"、\"暂不支持具体疾病判断\"这类与分割结果冲突的结论；" +
                "应围绕红色标注区域，客观描述其颜色、形态、边界、范围，并说明这属于辅助筛查结果，不能替代医生诊断。\n" +
                "安全原则：不能为了给出诊断而夸大病情；不要直接确诊恶性疾病；如果证据不足，请写\"倾向\"、\"需皮肤科进一步评估\"。\n" +
                "请严格按以下格式输出，不要使用任何markdown格式、特殊符号、英文：\n\n" +
                "【中医分析】\n先说明分割模型提示存在疑似皮损区域，再根据颜色、形态、范围分析可能证型倾向；不要推荐具体方剂，可给调护建议（约150字）\n\n" +
                "【西医参考】\n先描述客观可见表现和分割结果，再给出可能疾病方向或需排查方向；不能写无异常，不能作最终诊断（约120字）\n\n" +
                "【温馨提示】\n说明以上分析仅供辅助筛查，如皮损增大、颜色变化、出血疼痛或持续不适，建议前往正规医院皮肤科确诊（约50字）",
                lesionPct, confidence * 100
        );

        Map<String, Object> textContent = Map.of("type", "text", "text", promptText);
        messageContent.add(textContent);

        Map<String, Object> userMsg = new LinkedHashMap<>();
        userMsg.put("role", "user");
        userMsg.put("content", messageContent);

        Map<String, Object> systemMsg = Map.of(
                "role", "system",
                "content", "你是一位专业的中医皮肤科专家，只使用纯中文回复，不使用任何markdown格式和特殊符号，不使用英文。"
        );

        Map<String, Object> requestBody = Map.of(
                "model", "qwen-vl-plus",
                "messages", List.of(systemMsg, userMsg),
                "temperature", 0.2,
                "max_tokens", 2048
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        String apiUrl = baseUrl + "/chat/completions";

        ResponseEntity<String> vlResponse = restTemplate.exchange(
                apiUrl, HttpMethod.POST, entity, String.class
        );

        if (!vlResponse.getStatusCode().is2xxSuccessful() || vlResponse.getBody() == null) {
            throw new RuntimeException("Qwen-VL API returned: " + vlResponse.getStatusCode());
        }

        JsonNode root = objectMapper.readTree(vlResponse.getBody());
        String aiContent = root.path("choices").path(0).path("message").path("content").asText("");

        if (aiContent.isBlank()) {
            throw new RuntimeException("Qwen-VL returned empty content");
        }

        // Parse sections
        String tcmAnalysis = "";
        String westernDiagnosis = "";

        String[] sections = aiContent.split("【|】");
        for (int i = 0; i < sections.length; i++) {
            String s = sections[i].trim();
            if (s.contains("中医分析")) {
                tcmAnalysis = (i + 1 < sections.length) ? sections[i + 1].trim() : "";
            } else if (s.contains("西医参考")) {
                westernDiagnosis = (i + 1 < sections.length) ? sections[i + 1].trim() : "";
            }
        }

        // If parsing failed, put everything in tcmAnalysis
        if (tcmAnalysis.isEmpty() && westernDiagnosis.isEmpty()) {
            tcmAnalysis = aiContent;
            westernDiagnosis = "详见上方分析内容";
        }

        if (isContradictoryNoLesionAnalysis(lesionPct, tcmAnalysis + "\n" + westernDiagnosis)) {
            log.warn("Qwen-VL output contradicted segmentation result, using segmentation-consistent fallback. lesion={}%, confidence={}",
                    String.format("%.1f", lesionPct), String.format("%.3f", confidence));
            return buildSegmentationConsistentAnalysis(lesionPct, confidence);
        }

        return new String[]{tcmAnalysis, westernDiagnosis};
    }

    static boolean isContradictoryNoLesionAnalysis(double lesionPct, String analysisText) {
        if (lesionPct < 2.0 || analysisText == null || analysisText.isBlank()) {
            return false;
        }
        String normalized = analysisText.replaceAll("\\s+", "");
        String[] noLesionPhrases = {
                "未见明显异常皮损",
                "未见明确异常皮损",
                "未见明显皮肤病变",
                "未见明确皮肤病变",
                "未检测到明显皮肤病变",
                "暂不支持具体疾病判断",
                "暂不支持明确证型判断",
                "不做具体疾病诊断",
                "无红斑、丘疹、鳞屑、水疱、破溃"
        };
        for (String phrase : noLesionPhrases) {
            if (normalized.contains(phrase)) {
                return true;
            }
        }
        return false;
    }

    static String[] buildSegmentationConsistentAnalysis(double lesionPct, double confidence) {
        String lesionPctText = String.format("%.1f%%", lesionPct);
        String confidenceText = String.format("%.1f%%", confidence * 100);
        return new String[]{
                "分割模型已标出疑似皮损区域，面积约占图像" + lesionPctText + "，模型置信度约" + confidenceText + "。因此本次结果不应判定为无明显异常。中医角度建议重点观察该区域颜色深浅、边界是否清楚、是否伴瘙痒疼痛、渗出脱屑等表现，可作为局部皮损倾向进行辅助分析；目前不建议仅凭图片直接开具具体方剂，应结合病程和面诊进一步判断。",
                "智能分割结果提示存在可疑皮损区域，面积约" + lesionPctText + "，不应判定为无异常。西医角度建议结合皮肤镜、病史变化、颜色和边界特征进一步评估，当前系统结果仅作为筛查参考，不能替代皮肤科医生诊断。"
        };
    }

    private String getDiseaseLabel(double lesionPct) {
        if (lesionPct < 2) return "未检测到明显皮肤病变";
        if (lesionPct < 5) return "疑似轻微皮肤病变";
        if (lesionPct < 20) return "检测到局部皮肤病变";
        if (lesionPct < 50) return "检测到较大面积皮肤病变";
        return "检测到大面积皮肤病变";
    }

    /**
     * 获取检测历史
     */
    @GetMapping("/history")
    @Operation(summary = "获取检测历史", description = "获取当前用户的皮肤病检测历史记录")
    public ResponseEntity<?> getHistory(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "未登录"));
        }
        List<SkinDetectionRecord> records = detectionRecordRepository
                .findByUserIdOrderByCreatedAtDesc(currentUser.getId());
        return ResponseEntity.ok(Map.of("success", true, "records", records));
    }

    /**
     * 检查分割服务状态
     */
    @GetMapping("/status")
    @Operation(summary = "检测服务状态", description = "检查皮肤病分割模型服务是否在线")
    public ResponseEntity<?> checkStatus() {
        try {
            ResponseEntity<String> health = restTemplate.getForEntity(
                    pythonServiceUrl + "/health", String.class);
            if (health.getStatusCode().is2xxSuccessful()) {
                return ResponseEntity.ok(Map.of(
                        "success", true, "status", "online", "pythonService", "running"
                ));
            }
        } catch (Exception e) {
            log.debug("Python service health check failed: {}", e.getMessage());
        }
        return ResponseEntity.ok(Map.of(
                "success", false, "status", "offline",
                "message", "皮肤病分割模型服务未启动"
        ));
    }
}
