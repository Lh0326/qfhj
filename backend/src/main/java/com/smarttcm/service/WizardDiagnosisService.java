package com.smarttcm.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarttcm.dto.WizardDTOs.*;
import com.smarttcm.entity.*;
import com.smarttcm.exception.CustomException;
import com.smarttcm.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * WizardDiagnosisService - 向导式问诊服务
 * 处理向导式问诊的全部业务逻辑，包含7个步骤和AI诊断
 */
@Service
public class WizardDiagnosisService {

    private static final Logger log = LoggerFactory.getLogger(WizardDiagnosisService.class);

    private final WizardDiagnosisSessionRepository sessionRepository;
    private final WizardSymptomDictRepository symptomDictRepository;
    private final WizardSymptomAssessmentRepository assessmentRepository;
    private final WizardMeridianCollectionRepository meridianRepository;
    private final WizardDurationRecordRepository durationRepository;
    private final WizardAiDiagnosisRepository aiDiagnosisRepository;
    private final WizardCombinedFormulaRepository combinedFormulaRepository;
    private final WizardFollowupRepository followupRepository;
    private final WizardConsultationRepository consultationRepository;
    private final WizardOperationLogRepository operationLogRepository;
    private final WizardSupplementaryInquiryRepository supplementaryRepository;
    private final DeepSeekService deepSeekService;
    private final ObjectMapper objectMapper;

    public WizardDiagnosisService(WizardDiagnosisSessionRepository sessionRepository,
                                  WizardSymptomDictRepository symptomDictRepository,
                                  WizardSymptomAssessmentRepository assessmentRepository,
                                  WizardMeridianCollectionRepository meridianRepository,
                                  WizardDurationRecordRepository durationRepository,
                                  WizardAiDiagnosisRepository aiDiagnosisRepository,
                                  WizardCombinedFormulaRepository combinedFormulaRepository,
                                  WizardFollowupRepository followupRepository,
                                  WizardConsultationRepository consultationRepository,
                                  WizardOperationLogRepository operationLogRepository,
                                  WizardSupplementaryInquiryRepository supplementaryRepository,
                                  DeepSeekService deepSeekService,
                                  ObjectMapper objectMapper) {
        this.sessionRepository = sessionRepository;
        this.symptomDictRepository = symptomDictRepository;
        this.assessmentRepository = assessmentRepository;
        this.meridianRepository = meridianRepository;
        this.durationRepository = durationRepository;
        this.aiDiagnosisRepository = aiDiagnosisRepository;
        this.combinedFormulaRepository = combinedFormulaRepository;
        this.followupRepository = followupRepository;
        this.consultationRepository = consultationRepository;
        this.operationLogRepository = operationLogRepository;
        this.supplementaryRepository = supplementaryRepository;
        this.deepSeekService = deepSeekService;
        this.objectMapper = objectMapper;
    }

    // ==================== 会话管理 ====================

    /**
     * 创建问诊会话
     */
    @Transactional
    public SessionResponse createSession(Long userId, CreateSessionRequest req) {
        WizardDiagnosisSession session = WizardDiagnosisSession.builder()
                .userId(userId)
                .patientName(req.getPatientName())
                .currentStep(1)
                .status("active")
                .build();
        session = sessionRepository.save(session);

        logOperation(session.getId(), 0, userId, "CREATE_SESSION", "session", null, "active");
        log.info("创建问诊会话: id={}, userId={}, patientName={}", session.getId(), userId, req.getPatientName());

        return toSessionResponse(session);
    }

    /**
     * 获取会话详情
     */
    public SessionResponse getSession(Long sessionId, Long userId) {
        WizardDiagnosisSession session = findSessionForUser(sessionId, userId);
        return toSessionResponse(session);
    }

    /**
     * 查询用户会话列表
     */
    public List<SessionResponse> listSessions(Long userId) {
        List<WizardDiagnosisSession> sessions = sessionRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return sessions.stream()
                .map(this::toSessionResponse)
                .collect(Collectors.toList());
    }

    /**
     * 归档会话
     */
    @Transactional
    public void completeSession(Long sessionId, Long userId) {
        WizardDiagnosisSession session = findSessionForUser(sessionId, userId);
        String oldStatus = session.getStatus();
        session.setStatus("completed");
        sessionRepository.save(session);

        logOperation(sessionId, 7, userId, "COMPLETE_SESSION", "status", oldStatus, "completed");
        log.info("归档问诊会话: id={}, userId={}", sessionId, userId);
    }

    // ==================== 第一步：症状选择与评估 ====================

    /**
     * 保存第一步 - 症状选择与评估
     */
    @Transactional
    public void saveStep1(Long userId, Long sessionId, Step1Request req) {
        WizardDiagnosisSession session = findSessionForUser(sessionId, userId);
        validateStep(session, 1);

        // 删除旧的评估数据并重新保存
        assessmentRepository.deleteBySessionId(sessionId);

        List<WizardSymptomAssessment> oldAssessments = Collections.emptyList();

        for (SymptomAssessmentItem item : req.getSymptoms()) {
            WizardSymptomAssessment assessment = WizardSymptomAssessment.builder()
                    .sessionId(sessionId)
                    .symptomId(item.getSymptomId())
                    .symptomName(item.getSymptomName())
                    .severity(item.getSeverity())
                    .skipAssessment(item.getSkipAssessment() != null ? item.getSkipAssessment() : false)
                    .build();
            assessmentRepository.save(assessment);
        }

        // 更新会话当前步骤
        if (session.getCurrentStep() < 2) {
            session.setCurrentStep(2);
            sessionRepository.save(session);
        }

        logOperation(sessionId, 1, userId, "SAVE_STEP1", "symptoms", null,
                req.getSymptoms().stream().map(SymptomAssessmentItem::getSymptomName).collect(Collectors.joining(",")));
        log.info("保存第一步数据: sessionId={}, symptomCount={}", sessionId, req.getSymptoms().size());
    }

    // ==================== 第二步：子午归经采集 ====================

    /**
     * 保存第二步 - 子午归经采集
     */
    @Transactional
    public void saveStep2(Long userId, Long sessionId, Step2Request req) {
        WizardDiagnosisSession session = findSessionForUser(sessionId, userId);
        validateStep(session, 2);

        // 删除旧的归经数据
        meridianRepository.deleteBySessionId(sessionId);

        // 保存新的归经数据
        if (req.getMeridians() != null) {
            for (MeridianItem item : req.getMeridians()) {
                WizardMeridianCollection meridian = WizardMeridianCollection.builder()
                        .sessionId(sessionId)
                        .assessmentId(item.getAssessmentId())
                        .symptomName(item.getSymptomName())
                        .attackTime(item.getAttackTime())
                        .attackMeridian(item.getAttackMeridian())
                        .bodyType(req.getBodyType())
                        .environmentFactors(req.getEnvironmentFactors())
                        .tongueCoating(req.getTongueCoating())
                        .tongueBody(req.getTongueBody())
                        .pulseType(req.getPulseType())
                        .build();
                meridianRepository.save(meridian);
            }
        }

        // 保存补充问诊数据
        supplementaryRepository.deleteBySessionId(sessionId);
        if (req.getSupplementaryInquiry() != null) {
            SupplementaryInquiry si = req.getSupplementaryInquiry();
            WizardSupplementaryInquiry entity = WizardSupplementaryInquiry.builder()
                    .sessionId(sessionId)
                    .coldHeat(si.getColdHeat())
                    .sweating(si.getSweating())
                    .bowel(si.getBowel())
                    .urine(si.getUrine())
                    .sleep(si.getSleep())
                    .taste(si.getTaste())
                    .complexion(si.getComplexion())
                    .symptomDetailsJson(si.getSymptomDetails() != null && !si.getSymptomDetails().isEmpty()
                            ? toJsonString(si.getSymptomDetails()) : null)
                    .build();
            supplementaryRepository.save(entity);
        }

        // 更新会话当前步骤
        if (session.getCurrentStep() < 3) {
            session.setCurrentStep(3);
            sessionRepository.save(session);
        }

        logOperation(sessionId, 2, userId, "SAVE_STEP2", "meridians", null,
                req.getMeridians() != null ? String.valueOf(req.getMeridians().size()) : "0");
        log.info("保存第二步数据: sessionId={}, meridianCount={}", sessionId,
                req.getMeridians() != null ? req.getMeridians().size() : 0);
    }

    // ==================== 第三步：六经传变持续时日 ====================

    /**
     * 保存第三步 - 六经传变持续时日
     */
    @Transactional
    public void saveStep3(Long userId, Long sessionId, Step3Request req) {
        WizardDiagnosisSession session = findSessionForUser(sessionId, userId);
        validateStep(session, 3);

        // 删除旧的持续时日数据
        durationRepository.deleteBySessionId(sessionId);

        // 保存新的持续时日数据
        if (req.getDurations() != null) {
            for (DurationItem item : req.getDurations()) {
                WizardDurationRecord record = WizardDurationRecord.builder()
                        .sessionId(sessionId)
                        .assessmentId(item.getAssessmentId())
                        .symptomName(item.getSymptomName())
                        .durationDays(item.getDurationDays())
                        .durationHours(item.getDurationHours())
                        .liuJingStage(item.getLiuJingStage())
                        .build();
                durationRepository.save(record);
            }
        }

        // 更新会话当前步骤
        if (session.getCurrentStep() < 4) {
            session.setCurrentStep(4);
            sessionRepository.save(session);
        }

        logOperation(sessionId, 3, userId, "SAVE_STEP3", "durations", null,
                req.getDurations() != null ? String.valueOf(req.getDurations().size()) : "0");
        log.info("保存第三步数据: sessionId={}, durationCount={}", sessionId,
                req.getDurations() != null ? req.getDurations().size() : 0);
    }

    // ==================== 第四步：AI诊断 ====================

    /**
     * 执行AI诊断
     */
    @Transactional
    public DiagnosisResponse runDiagnosis(Long userId, Long sessionId) {
        WizardDiagnosisSession session = findSessionForUser(sessionId, userId);
        validateStep(session, 4);

        // 若前一次已经成功生成结果，重复点击/前端自动重试时直接返回，避免重复调用AI。
        Optional<WizardAiDiagnosis> existingDiagnosis = aiDiagnosisRepository.findBySessionId(sessionId);
        if (existingDiagnosis.isPresent()) {
            Map<String, Object> existingStructured = parseJsonToMap(existingDiagnosis.get().getStructuredResult());
            log.info("AI诊断已存在，直接返回缓存结果: sessionId={}", sessionId);
            return toDiagnosisResponse(existingDiagnosis.get(), existingStructured);
        }

        // 加载所有前三步数据
        List<WizardSymptomAssessment> assessments = assessmentRepository.findBySessionId(sessionId);
        List<WizardMeridianCollection> meridians = meridianRepository.findBySessionId(sessionId);
        List<WizardDurationRecord> durations = durationRepository.findBySessionId(sessionId);
        WizardSupplementaryInquiry supplementary = supplementaryRepository.findBySessionId(sessionId).orElse(null);

        if (assessments.isEmpty()) {
            throw new CustomException("请先完成症状选择（第一步）");
        }

        // 构建结构化提示词
        String userPrompt = buildDiagnosisPrompt(assessments, meridians, durations, supplementary, session.getPatientName());

        String aiResponse = callDiagnosisAiWithSelfRetry(userPrompt, sessionId);
        Map<String, Object> structuredResult;
        if (isInvalidAiDiagnosisText(aiResponse)) {
            // 最后一层保护：云端AI临时失败/返回乱码时，不把用户卡在报错界面，而是生成可解释的规则兜底结果。
            log.warn("AI诊断多次重试后仍不可用，启用规则兜底结果: sessionId={}, lastResponse={}", sessionId, previewText(aiResponse));
            structuredResult = buildRuleBasedDiagnosisFallback(assessments, meridians, durations, supplementary);
            aiResponse = extractStringField(structuredResult, "fullAnalysis");
        } else {
            aiResponse = sanitizeAiText(aiResponse);
            structuredResult = parseAiResponseToStructure(aiResponse);
            ensureClinicallyUsefulStructure(structuredResult, assessments, meridians, durations);
            String primaryAfterEnsure = extractStringField(structuredResult, "primarySyndrome");
            if (primaryAfterEnsure.isBlank() || isInvalidAiDiagnosisText(primaryAfterEnsure)) {
                log.warn("AI诊断结构字段缺失，启用规则兜底结构: sessionId={}, primary={}", sessionId, previewText(primaryAfterEnsure));
                structuredResult = buildRuleBasedDiagnosisFallback(assessments, meridians, durations, supplementary);
                aiResponse = extractStringField(structuredResult, "fullAnalysis");
            }
        }
        String structuredJson = toJsonString(structuredResult);

        String primarySyndrome = extractStringField(structuredResult, "primarySyndrome");
        String secondarySyndromes = extractStringField(structuredResult, "secondarySyndromes");
        String treatmentMethod = extractStringField(structuredResult, "treatmentMethod");
        Double confidenceScore = extractConfidenceScore(structuredResult);

        // 删除旧的诊断结果并保存新的
        aiDiagnosisRepository.deleteBySessionId(sessionId);

        WizardAiDiagnosis diagnosis = WizardAiDiagnosis.builder()
                .sessionId(sessionId)
                .primarySyndrome(primarySyndrome)
                .secondarySyndromes(secondarySyndromes)
                .treatmentMethod(treatmentMethod)
                .confidenceScore(confidenceScore)
                .rawAiResponse(aiResponse)
                .structuredResult(structuredJson)
                .build();
        diagnosis = aiDiagnosisRepository.save(diagnosis);

        // 更新会话当前步骤
        if (session.getCurrentStep() < 5) {
            session.setCurrentStep(5);
            sessionRepository.save(session);
        }

        logOperation(sessionId, 4, userId, "RUN_DIAGNOSIS", "diagnosis", null, primarySyndrome);
        log.info("AI诊断完成: sessionId={}, primarySyndrome={}", sessionId, primarySyndrome);

        return toDiagnosisResponse(diagnosis, structuredResult);
    }

    /**
     * 获取诊断结果
     */
    public DiagnosisResponse getDiagnosis(Long sessionId, Long userId) {
        findSessionForUser(sessionId, userId);
        WizardAiDiagnosis diagnosis = aiDiagnosisRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new CustomException("尚未进行AI诊断"));

        Map<String, Object> structuredResult = parseJsonToMap(diagnosis.getStructuredResult());
        return toDiagnosisResponse(diagnosis, structuredResult);
    }

    // ==================== 第五步：合病合方 ====================

    /**
     * 保存第五步 - 合病合方
     */
    @Transactional
    public Step5Response saveStep5(Long userId, Long sessionId, Step5Request req) {
        WizardDiagnosisSession session = findSessionForUser(sessionId, userId);
        validateStep(session, 5);

        // 如果标记为合病，调用AI生成合方推荐
        String recommendedFormula = req.getRecommendedFormula();
        String analysis = null;
        String formulaText = null;
        String modification = null;
        log.info("Step5: hasCombined={}, combinedSyndromes={}", req.getHasCombined(), req.getCombinedSyndromes());
        if (Boolean.TRUE.equals(req.getHasCombined()) && req.getCombinedSyndromes() != null) {
            WizardAiDiagnosis diagnosis = aiDiagnosisRepository.findBySessionId(sessionId)
                    .orElseThrow(() -> new CustomException("请先完成AI诊断"));

            // 第五步合病合方：调用云端AI，不可用时直接报错。
            if (!deepSeekService.isCloudConfigured()) {
                throw new CustomException("AI服务未配置，无法生成合方推荐。请配置 QWEN_API_KEY 后重试。");
            }
            String aiRecommendation = generateCombinedFormulaRecommendation(
                    diagnosis.getPrimarySyndrome(), diagnosis.getSecondarySyndromes(), req.getCombinedSyndromes());
            if (aiRecommendation == null || aiRecommendation.isBlank() || isInvalidAiDiagnosisText(sanitizeAiText(aiRecommendation))) {
                throw new CustomException("AI合方推荐返回异常结果，请稍后重试。");
            }
            aiRecommendation = sanitizeAiText(aiRecommendation);
            if (aiRecommendation != null && !aiRecommendation.isBlank()) {
                // 尝试解析AI返回的JSON（可能被```json```包裹）；解析失败时使用专业规则兜底，不把乱码原文展示给用户。
                Map<String, Object> parsed = parseJsonToMap(extractJsonObject(aiRecommendation));
                if (!parsed.isEmpty()) {
                    analysis = sanitizeAiText(extractStringField(parsed, "analysis"));
                    formulaText = sanitizeAiText(extractStringField(parsed, "formula"));
                    modification = sanitizeAiText(extractStringField(parsed, "modification"));
                }
                if (isInvalidAiDiagnosisText(analysis) || analysis == null || analysis.isBlank()) {
                    throw new CustomException("AI合方分析结果无效，请稍后重试。");
                }
                recommendedFormula = formulaText != null && !formulaText.isBlank() ? formulaText : analysis;
            }
        }

        // 删除旧的合病合方数据
        combinedFormulaRepository.deleteBySessionId(sessionId);

        WizardCombinedFormula formula = WizardCombinedFormula.builder()
                .sessionId(sessionId)
                .hasCombined(req.getHasCombined() != null ? req.getHasCombined() : false)
                .combinedSyndromes(req.getCombinedSyndromes())
                .recommendedFormula(recommendedFormula)
                .isApplied(req.getIsApplied() != null ? req.getIsApplied() : false)
                .build();
        combinedFormulaRepository.save(formula);

        // 更新会话当前步骤
        if (session.getCurrentStep() < 6) {
            session.setCurrentStep(6);
            sessionRepository.save(session);
        }

        logOperation(sessionId, 5, userId, "SAVE_STEP5", "combinedFormula", null,
                String.valueOf(req.getHasCombined()));
        log.info("保存第五步数据: sessionId={}, hasCombined={}, analysis={}, hasAnalysis={}",
                sessionId, req.getHasCombined(), analysis != null ? analysis.substring(0, Math.min(50, analysis.length())) : "null", analysis != null);

        Step5Response resp = Step5Response.builder()
                .analysis(analysis)
                .formula(formulaText)
                .modification(modification)
                .build();
        log.info("Step5Response built: analysis={}, formula={}", resp.getAnalysis() != null, resp.getFormula() != null);
        return resp;
    }

    // ==================== 第六步：疗效评估 ====================

    /**
     * 保存第六步 - 疗效评估
     */
    @Transactional
    public Step6Response saveStep6(Long userId, Long sessionId, Step6Request req) {
        WizardDiagnosisSession session = findSessionForUser(sessionId, userId);
        validateStep(session, 6);

        // 调用AI进行疗效评估和方案调整
        String adjustedPlan = req.getAdjustedPlan();
        if (req.getSymptomEvaluations() != null && !req.getSymptomEvaluations().isBlank()) {
            WizardAiDiagnosis diagnosis = aiDiagnosisRepository.findBySessionId(sessionId)
                    .orElseThrow(() -> new CustomException("请先完成AI诊断"));
            List<WizardSymptomAssessment> originalSymptoms = assessmentRepository.findBySessionId(sessionId);

            // 读取合方选择，影响评估上下文
            String combinedContext = "";
            combinedFormulaRepository.findBySessionId(sessionId).ifPresent(cf -> {
                // 仅记录，不在此处修改
            });
            WizardCombinedFormula combinedFormula = combinedFormulaRepository.findBySessionId(sessionId).orElse(null);

            // 第六步疗效评估：调用云端AI，不可用时直接报错。
            if (!deepSeekService.isCloudConfigured()) {
                throw new CustomException("AI服务未配置，无法进行疗效评估。请配置 QWEN_API_KEY 后重试。");
            }
            String aiAdjustedPlan = generateAdjustedPlan(diagnosis.getRawAiResponse(), originalSymptoms,
                    req.getOverallEvaluation(), req.getSymptomEvaluations(), req.getFeedback(), combinedFormula);
            if (aiAdjustedPlan == null || aiAdjustedPlan.isBlank() || isInvalidAiDiagnosisText(sanitizeAiText(aiAdjustedPlan))) {
                throw new CustomException("AI疗效评估返回异常结果，请稍后重试。");
            }
            aiAdjustedPlan = sanitizeAiText(aiAdjustedPlan);
            if (aiAdjustedPlan != null && !aiAdjustedPlan.isBlank()) {
                adjustedPlan = aiAdjustedPlan;
            }
        }

        // 删除旧的随访数据
        followupRepository.deleteBySessionId(sessionId);

        WizardFollowup followup = WizardFollowup.builder()
                .sessionId(sessionId)
                .overallEvaluation(req.getOverallEvaluation())
                .symptomEvaluations(req.getSymptomEvaluations())
                .adjustedPlan(adjustedPlan)
                .feedback(req.getFeedback())
                .build();
        followupRepository.save(followup);

        // 更新会话当前步骤
        if (session.getCurrentStep() < 7) {
            session.setCurrentStep(7);
            sessionRepository.save(session);
        }

        logOperation(sessionId, 6, userId, "SAVE_STEP6", "followup", null, req.getOverallEvaluation());
        log.info("保存第六步数据: sessionId={}, evaluation={}", sessionId, req.getOverallEvaluation());

        return Step6Response.builder().adjustedPlan(adjustedPlan).build();
    }

    // ==================== 第七步：多流派会诊 ====================

    /**
     * 保存第七步 - 多流派会诊
     */
    @Transactional
    public Step7Response saveStep7(Long userId, Long sessionId, Step7Request req) {
        WizardDiagnosisSession session = findSessionForUser(sessionId, userId);
        validateStep(session, 7);

        // 如果没有提供会诊结果，调用AI一次性生成多流派会诊 + 最终方案
        String consultationResults = req.getConsultationResults();
        String finalPlan = req.getFinalPlan();

        if ((consultationResults == null || consultationResults.isBlank()) ||
                (req.getSelectedSchool() != null && !req.getSelectedSchool().isBlank())) {
            WizardAiDiagnosis diagnosis = aiDiagnosisRepository.findBySessionId(sessionId)
                    .orElseThrow(() -> new CustomException("请先完成AI诊断"));
            List<WizardSymptomAssessment> symptoms = assessmentRepository.findBySessionId(sessionId);
            List<WizardMeridianCollection> meridians = meridianRepository.findBySessionId(sessionId);

            // 合并为一次AI调用：同时生成多流派会诊 + 最终方案
            if (consultationResults == null || consultationResults.isBlank()) {
                // 截断原始诊断以减少输入长度
                String rawDiag = diagnosis.getRawAiResponse();
                if (rawDiag != null && rawDiag.length() > 1500) {
                    rawDiag = rawDiag.substring(0, 1500) + "...(已截断)";
                }
                // 读取合方选择，影响会诊上下文
                WizardCombinedFormula combinedFormula = combinedFormulaRepository.findBySessionId(sessionId).orElse(null);
                // 第七步多流派会诊：调用云端AI，不可用时直接报错。
                if (!deepSeekService.isCloudConfigured()) {
                    throw new CustomException("AI服务未配置，无法进行多流派会诊。请配置 QWEN_API_KEY 后重试。");
                }
                String aiResult = generateConsultationAndPlan(symptoms, meridians, diagnosis.getRawAiResponse(), combinedFormula);
                if (aiResult == null || aiResult.isBlank() || isInvalidAiDiagnosisText(sanitizeAiText(aiResult))) {
                    throw new CustomException("AI会诊返回异常结果，请稍后重试。");
                }
                aiResult = sanitizeAiText(aiResult);
                log.info("Step7 AI会诊+方案: {}", aiResult != null ? "length=" + aiResult.length() : "NULL");
                if (aiResult != null && !aiResult.isBlank()) {
                    // 用分隔符拆分会诊结果和最终方案
                    String[] parts = aiResult.split("===最终综合方案===");
                    consultationResults = parts[0].trim();
                    if (parts.length > 1) {
                        finalPlan = parts[1].trim();
                    } else {
                        finalPlan = aiResult; // fallback: 整段作为会诊结果
                    }
                }
            }
        }

        // 删除旧的会诊数据
        consultationRepository.deleteBySessionId(sessionId);

        WizardConsultation consultation = WizardConsultation.builder()
                .sessionId(sessionId)
                .consultationResults(consultationResults)
                .selectedSchool(req.getSelectedSchool())
                .finalPlan(finalPlan)
                .build();
        consultationRepository.save(consultation);

        logOperation(sessionId, 7, userId, "SAVE_STEP7", "consultation", null, req.getSelectedSchool());
        log.info("保存第七步数据: sessionId={}, school={}, hasConsultation={}, hasFinalPlan={}",
                sessionId, req.getSelectedSchool(),
                consultationResults != null && !consultationResults.isBlank(),
                finalPlan != null && !finalPlan.isBlank());

        return Step7Response.builder()
                .consultationResults(consultationResults)
                .finalPlan(finalPlan)
                .build();
    }

    // ==================== 症状字典 ====================

    /**
     * 删除问诊会话及其所有关联数据
     */
    @Transactional
    public void deleteSession(Long sessionId, Long userId) {
        WizardDiagnosisSession session = findSessionForUser(sessionId, userId);

        // 按依赖顺序删除所有子记录
        operationLogRepository.deleteBySessionId(sessionId);
        consultationRepository.deleteBySessionId(sessionId);
        followupRepository.deleteBySessionId(sessionId);
        combinedFormulaRepository.deleteBySessionId(sessionId);
        aiDiagnosisRepository.deleteBySessionId(sessionId);
        supplementaryRepository.deleteBySessionId(sessionId);
        durationRepository.deleteBySessionId(sessionId);
        meridianRepository.deleteBySessionId(sessionId);
        assessmentRepository.deleteBySessionId(sessionId);

        // 最后删除会话本身
        sessionRepository.delete(session);

        log.info("删除问诊会话: id={}, userId={}", sessionId, userId);
    }

    /**
     * 获取所有症状字典项
     */
    public List<SymptomDictItem> listSymptoms() {
        List<WizardSymptomDict> symptoms = symptomDictRepository.findAllByOrderBySortOrderAsc();
        return symptoms.stream()
                .map(this::toSymptomDictItem)
                .collect(Collectors.toList());
    }

    /**
     * 按分类查询症状字典
     */
    public List<SymptomDictItem> listSymptomsByCategory(String category) {
        List<WizardSymptomDict> symptoms = symptomDictRepository.findByCategoryOrderBySortOrderAsc(category);
        return symptoms.stream()
                .map(this::toSymptomDictItem)
                .collect(Collectors.toList());
    }

    // ==================== 操作日志 ====================

    /**
     * 记录操作日志
     */
    public void logOperation(Long sessionId, Integer stepNo, Long operatorId,
                             String operation, String fieldName, String oldValue, String newValue) {
        WizardOperationLog logEntry = WizardOperationLog.builder()
                .sessionId(sessionId)
                .stepNo(stepNo)
                .operatorId(operatorId)
                .operation(operation)
                .fieldName(fieldName)
                .oldValue(oldValue)
                .newValue(newValue)
                .build();
        operationLogRepository.save(logEntry);
    }

    /**
     * 查询会话操作日志
     */
    public List<OperationLogResponse> getOperationLogs(Long sessionId, Long userId) {
        findSessionForUser(sessionId, userId);
        List<WizardOperationLog> logs = operationLogRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        return logs.stream()
                .map(this::toOperationLogResponse)
                .collect(Collectors.toList());
    }

    // ==================== Session Resume: Step Data Retrieval ====================

    public List<Step1DataResponse> getStep1Data(Long sessionId, Long userId) {
        findSessionForUser(sessionId, userId);
        List<WizardSymptomAssessment> assessments = assessmentRepository.findBySessionId(sessionId);
        return assessments.stream().map(a -> Step1DataResponse.builder()
                .symptomId(a.getSymptomId())
                .symptomName(a.getSymptomName())
                .severity(a.getSeverity())
                .skipAssessment(a.getSkipAssessment())
                .build()
        ).collect(Collectors.toList());
    }

    public Step2DataResponse getStep2Data(Long sessionId, Long userId) {
        findSessionForUser(sessionId, userId);
        List<WizardMeridianCollection> meridians = meridianRepository.findBySessionId(sessionId);
        if (meridians.isEmpty()) return null;
        WizardMeridianCollection first = meridians.get(0);

        // 恢复补充问诊数据
        SupplementaryInquiry siDto = null;
        WizardSupplementaryInquiry siEntity = supplementaryRepository.findBySessionId(sessionId).orElse(null);
        if (siEntity != null) {
            List<SymptomSpecificDetail> details = null;
            if (siEntity.getSymptomDetailsJson() != null && !siEntity.getSymptomDetailsJson().isBlank()) {
                try {
                    details = objectMapper.readValue(siEntity.getSymptomDetailsJson(),
                            new TypeReference<List<SymptomSpecificDetail>>() {});
                } catch (JsonProcessingException e) {
                    log.warn("解析症状特异补充JSON失败: {}", e.getMessage());
                }
            }
            siDto = SupplementaryInquiry.builder()
                    .coldHeat(siEntity.getColdHeat())
                    .sweating(siEntity.getSweating())
                    .bowel(siEntity.getBowel())
                    .urine(siEntity.getUrine())
                    .sleep(siEntity.getSleep())
                    .taste(siEntity.getTaste())
                    .complexion(siEntity.getComplexion())
                    .symptomDetails(details)
                    .build();
        }

        return Step2DataResponse.builder()
                .bodyType(first.getBodyType())
                .environmentFactors(first.getEnvironmentFactors())
                .tongueCoating(first.getTongueCoating())
                .tongueBody(first.getTongueBody())
                .pulseType(first.getPulseType())
                .meridians(meridians.stream().map(m -> MeridianItem.builder()
                        .assessmentId(m.getAssessmentId())
                        .symptomName(m.getSymptomName())
                        .attackTime(m.getAttackTime())
                        .attackMeridian(m.getAttackMeridian())
                        .build()
                ).collect(Collectors.toList()))
                .supplementaryInquiry(siDto)
                .build();
    }

    public List<Step3DataResponse> getStep3Data(Long sessionId, Long userId) {
        findSessionForUser(sessionId, userId);
        List<WizardDurationRecord> durations = durationRepository.findBySessionId(sessionId);
        return durations.stream().map(d -> Step3DataResponse.builder()
                .assessmentId(d.getAssessmentId())
                .symptomName(d.getSymptomName())
                .durationDays(d.getDurationDays())
                .durationHours(d.getDurationHours())
                .liuJingStage(d.getLiuJingStage())
                .build()
        ).collect(Collectors.toList());
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 查找属于用户的会话
     */
    private WizardDiagnosisSession findSessionForUser(Long sessionId, Long userId) {
        return sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new CustomException("问诊会话不存在或无权访问"));
    }

    /**
     * 验证当前步骤是否允许操作
     */
    private void validateStep(WizardDiagnosisSession session, int targetStep) {
        if (!"active".equals(session.getStatus())) {
            throw new CustomException("会话已归档，无法继续操作");
        }
        if (session.getCurrentStep() < targetStep - 1) {
            throw new CustomException("请先完成前面的步骤，当前步骤：" + session.getCurrentStep());
        }
    }

    /**
     * 构建AI诊断提示词
     */
    private String buildDiagnosisPrompt(List<WizardSymptomAssessment> assessments,
                                        List<WizardMeridianCollection> meridians,
                                        List<WizardDurationRecord> durations,
                                        WizardSupplementaryInquiry supplementary,
                                        String patientName) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("请根据以下结构化问诊数据进行中医辨证诊断。\n\n");

        if (patientName != null && !patientName.isBlank()) {
            prompt.append("患者姓名：").append(patientName).append("\n\n");
        }

        // 症状与程度
        prompt.append("【症状与程度评估】\n");
        for (WizardSymptomAssessment a : assessments) {
            prompt.append("- ").append(a.getSymptomName());
            if (Boolean.TRUE.equals(a.getSkipAssessment())) {
                prompt.append("（跳过程度评估）");
            } else if (a.getSeverity() != null) {
                prompt.append("，程度：").append(a.getSeverity());
            }
            prompt.append("\n");
        }
        prompt.append("\n");

        // 子午归经信息
        if (!meridians.isEmpty()) {
            prompt.append("【子午归经·发作时间】\n");
            // 收集全局四诊信息（取第一条记录中的舌诊脉诊）
            WizardMeridianCollection first = meridians.get(0);
            if (first.getBodyType() != null && !first.getBodyType().isBlank()) {
                prompt.append("体质类型：").append(first.getBodyType()).append("\n");
            }
            if (first.getEnvironmentFactors() != null && !first.getEnvironmentFactors().isBlank()) {
                prompt.append("环境因素：").append(first.getEnvironmentFactors()).append("\n");
            }
            if (first.getTongueCoating() != null && !first.getTongueCoating().isBlank()) {
                prompt.append("舌苔：").append(first.getTongueCoating()).append("\n");
            }
            if (first.getTongueBody() != null && !first.getTongueBody().isBlank()) {
                prompt.append("舌体：").append(first.getTongueBody()).append("\n");
            }
            if (first.getPulseType() != null && !first.getPulseType().isBlank()) {
                prompt.append("脉象：").append(first.getPulseType()).append("\n");
            }
            prompt.append("\n各症状发作时间与归经：\n");
            for (WizardMeridianCollection m : meridians) {
                prompt.append("- ").append(m.getSymptomName());
                if (m.getAttackTime() != null && !m.getAttackTime().isBlank()) {
                    prompt.append("，发作时间：").append(m.getAttackTime());
                }
                if (m.getAttackMeridian() != null && !m.getAttackMeridian().isBlank()) {
                    prompt.append("，归经：").append(m.getAttackMeridian());
                }
                prompt.append("\n");
            }
            prompt.append("\n");
        }

        // 补充问诊·十问歌详查
        if (supplementary != null) {
            boolean hasAny = false;
            StringBuilder siSection = new StringBuilder();
            siSection.append("【补充问诊·十问歌详查】\n");
            if (supplementary.getColdHeat() != null && !supplementary.getColdHeat().isBlank()) {
                siSection.append("寒热：").append(supplementary.getColdHeat()).append("\n"); hasAny = true;
            }
            if (supplementary.getSweating() != null && !supplementary.getSweating().isBlank()) {
                siSection.append("汗出：").append(supplementary.getSweating()).append("\n"); hasAny = true;
            }
            if (supplementary.getBowel() != null && !supplementary.getBowel().isBlank()) {
                siSection.append("大便：").append(supplementary.getBowel()).append("\n"); hasAny = true;
            }
            if (supplementary.getUrine() != null && !supplementary.getUrine().isBlank()) {
                siSection.append("小便：").append(supplementary.getUrine()).append("\n"); hasAny = true;
            }
            if (supplementary.getSleep() != null && !supplementary.getSleep().isBlank()) {
                siSection.append("睡眠：").append(supplementary.getSleep()).append("\n"); hasAny = true;
            }
            if (supplementary.getTaste() != null && !supplementary.getTaste().isBlank()) {
                siSection.append("口味：").append(supplementary.getTaste()).append("\n"); hasAny = true;
            }
            if (supplementary.getComplexion() != null && !supplementary.getComplexion().isBlank()) {
                siSection.append("面色：").append(supplementary.getComplexion()).append("\n"); hasAny = true;
            }
            // 症状特异补充
            if (supplementary.getSymptomDetailsJson() != null && !supplementary.getSymptomDetailsJson().isBlank()) {
                try {
                    List<Map<String, Object>> details = objectMapper.readValue(
                            supplementary.getSymptomDetailsJson(),
                            new TypeReference<List<Map<String, Object>>>() {});
                    if (!details.isEmpty()) {
                        siSection.append("症状特异信息：\n");
                        for (Map<String, Object> d : details) {
                            siSection.append("- ").append(d.getOrDefault("symptomName", ""));
                            appendIfNotBlank(siSection, "部位", d.get("painLocation"));
                            appendIfNotBlank(siSection, "性质", d.get("painNature"));
                            appendIfNotBlank(siSection, "痰", d.get("sputumType"));
                            appendIfNotBlank(siSection, "饮食", d.get("digestionDetail"));
                            appendIfNotBlank(siSection, "情志", d.get("emotionDetail"));
                            siSection.append("\n");
                            hasAny = true;
                        }
                    }
                } catch (JsonProcessingException e) {
                    log.warn("解析症状特异补充JSON失败: {}", e.getMessage());
                }
            }
            if (hasAny) {
                siSection.append("\n");
                prompt.append(siSection);
            }
        }

        // 六经传变持续时日
        if (!durations.isEmpty()) {
            prompt.append("【六经传变·持续时日】\n");
            for (WizardDurationRecord d : durations) {
                prompt.append("- ").append(d.getSymptomName());
                if (d.getDurationDays() != null) {
                    prompt.append("，持续").append(d.getDurationDays()).append("天");
                }
                if (d.getDurationHours() != null) {
                    prompt.append(d.getDurationHours()).append("小时");
                }
                if (d.getLiuJingStage() != null && !d.getLiuJingStage().isBlank()) {
                    prompt.append("，传变阶段：").append(d.getLiuJingStage());
                }
                prompt.append("\n");
            }
            prompt.append("\n");
        }

        prompt.append("【输出安全要求】只能使用规范中文医学表达；不要输出思维链、</think>、HTML、Markdown表格、英文控制符、乱码token或无意义编号。若资料不足，请写“资料不足，倾向判断”，不能编造未采集的舌脉。\n");
        prompt.append("请给出完整的中医辨证分析，必须体现基于中医诊断学的“四诊合参”和多体系交叉验证，包含：\n");
        prompt.append("1. 四诊概要与资料完整性（望诊含神色形态、面色、皮肤、舌质、舌苔；闻诊含声音、咳喘、气味；问诊按十问歌归纳寒热汗出、头身胸腹、饮食二便、睡眠情志、病程诱因；切诊含脉象、按诊。已提供的信息要引用，缺失项要提示建议补充）\n");
        prompt.append("2. 辨证分析（先判断主病、兼病、病位、病性，再给出主证、兼证；从八纲、脏腑、气血津液、经络、六经/卫气营血等交叉判断，避免只给单一诊断）\n");
        prompt.append("3. 证据链与鉴别辨证（每个证型必须对应四诊证据；至少给出1个容易混淆的证型并说明为什么不作为主证）\n");
        prompt.append("4. 合病合方分析（如存在多个证型或合并症状，说明主次关系和合方逻辑）\n");
        prompt.append("5. 治法与方药\n");
        prompt.append("6. 适宜疗法（针灸、食疗等）\n");
        prompt.append("7. 养生调护与危险信号（列出需及时就医的情况，如胸痛、呼吸困难、持续高热、出血、剧烈疼痛、意识异常等）\n");
        prompt.append("8. 通俗化解读（用大白话总结整个分析，让不懂中医的普通人也能看懂：你的身体出了什么问题、为什么会这样、应该怎么调理）\n\n");
        prompt.append("请在回答末尾附加一个JSON格式的结构化摘要，格式如下（用```json和```包裹）：\n");
        prompt.append("```json\n");
        prompt.append("{\n");
        prompt.append("  \"primarySyndrome\": \"主证型名称\",\n");
        prompt.append("  \"secondarySyndromes\": \"兼夹证型（如有多个用逗号分隔）\",\n");
        prompt.append("  \"fourDiagnosticsSummary\": \"望闻问切综合摘要，缺失信息也需注明\",\n");
        prompt.append("  \"differentiationEvidence\": \"八纲/脏腑/经络/六经等交叉辨证依据\",\n");
        prompt.append("  \"treatmentMethod\": \"治法（如：疏肝理气，健脾和胃）\",\n");
        prompt.append("  \"confidenceScore\": 0.85,\n");
        prompt.append("  \"formulaRecommendation\": \"推荐方剂名称\",\n");
        prompt.append("  \"acupoints\": [\"穴位1\", \"穴位2\"],\n");
        prompt.append("  \"dietAdvice\": \"食疗建议简述\",\n");
        prompt.append("  \"lifestyleAdvice\": \"调护建议简述\"\n");
        prompt.append("}\n");
        prompt.append("```\n");

        return prompt.toString();
    }

    private void appendIfNotBlank(StringBuilder sb, String label, Object value) {
        if (value != null && !value.toString().isBlank()) {
            sb.append("，").append(label).append("＝").append(value);
        }
    }

    private String callDiagnosisAiWithSelfRetry(String userPrompt, Long sessionId) {
        if (!deepSeekService.isCloudConfigured()) {
            log.warn("AI诊断云端Key未配置，跳过云端调用并启用兜底: sessionId={}", sessionId);
            return "";
        }
        String lastResponse = "";
        int maxAttempts = 1;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                String response = deepSeekService.chatWithHistory(
                        DeepSeekService.TCM_DIAGNOSIS_SYSTEM_PROMPT, userPrompt, null);
                response = sanitizeAiText(response);
                if (!isInvalidAiDiagnosisText(response)) {
                    if (attempt > 1) {
                        log.info("AI诊断第{}次自动重试成功: sessionId={}", attempt, sessionId);
                    }
                    return response;
                }
                lastResponse = response;
                log.warn("AI诊断第{}次返回无效，准备自动重试: sessionId={}, preview={}", attempt, sessionId, previewText(response));
            } catch (Exception e) {
                lastResponse = e.getMessage();
                log.warn("AI诊断第{}次调用异常，准备自动重试: sessionId={}, error={}", attempt, sessionId, e.getMessage(), e);
            }
            if (attempt < maxAttempts) {
                try {
                    Thread.sleep(1200L * attempt);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        return lastResponse == null ? "" : lastResponse;
    }

    private Map<String, Object> buildRuleBasedDiagnosisFallback(List<WizardSymptomAssessment> assessments,
                                                                 List<WizardMeridianCollection> meridians,
                                                                 List<WizardDurationRecord> durations,
                                                                 WizardSupplementaryInquiry supplementary) {
        String evidence = (buildEvidenceText(assessments, meridians, durations) + " " + buildSupplementaryEvidence(supplementary)).toLowerCase();
        String primary = inferPrimarySyndrome(evidence);
        String secondary = inferSecondarySyndrome(evidence, primary);
        String treatment = inferTreatmentMethod(primary, secondary);
        String fourSummary = buildFourDiagnosticSummary(assessments, meridians, durations);
        String differentiation = "规则兜底根据已采集症状严重程度、子午归经、舌脉与六经病程做保守辨证：以已填写信息为证据，缺失的望闻切诊信息不强行推断。";
        String formula = inferFormula(primary);
        String diet = "饮食以清淡、规律为主，避免辛辣油腻、生冷过量和熬夜；具体药物与方剂需由执业医师面诊后决定。";
        String lifestyle = "建议继续补充舌象、脉象、二便、睡眠、情志等信息；若出现胸痛、呼吸困难、持续高热、出血、意识异常或剧烈疼痛，应及时线下就医。";
        String combined = buildCombinedAnalysis(primary, secondary);
        String fullAnalysis = "一、四诊概要与资料完整性\n" + fourSummary + "\n\n" +
                "二、辨证分析\n主证倾向：" + primary + "。" +
                (secondary == null || secondary.isBlank() ? "暂未形成明确兼夹证。" : "兼夹证倾向：" + secondary + "。") +
                "本结论主要来自症状、归经、病程及已填写舌脉信息，属于辅助筛查，不替代医师诊断。\n\n" +
                "三、证据链与鉴别辨证\n" + differentiation + "需与相近证型继续鉴别，尤其要结合真实舌脉、寒热汗出、二便睡眠和既往病史复核。\n\n" +
                "四、合病合方分析\n" + combined + "\n\n" +
                "五、治法与方药\n治法参考：" + treatment + "。方剂方向参考：" + formula + "。请勿自行照方用药，需由中医师辨证加减。\n\n" +
                "六、适宜疗法\n可考虑规律作息、情志调节、温和运动、穴位按揉等非药物调护，针灸及中药应线下面诊后实施。\n\n" +
                "七、养生调护与危险信号\n" + lifestyle + "\n\n" +
                "八、通俗化解读\n简单说，系统根据你填写的症状和时间、舌脉等线索，先给出一个偏保守的中医证型方向，帮助你整理就诊前信息；最终诊疗仍以专业医师面诊为准。";

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("primarySyndrome", primary);
        result.put("secondarySyndromes", secondary);
        result.put("fourDiagnosticsSummary", fourSummary);
        result.put("differentiationEvidence", differentiation);
        result.put("treatmentMethod", treatment);
        result.put("confidenceScore", 0.58);
        result.put("formulaRecommendation", formula);
        result.put("acupoints", inferAcupoints(primary));
        result.put("dietAdvice", diet);
        result.put("lifestyleAdvice", lifestyle);
        result.put("fullAnalysis", fullAnalysis);
        return result;
    }

    private String buildSupplementaryEvidence(WizardSupplementaryInquiry supplementary) {
        if (supplementary == null) return "";
        StringBuilder sb = new StringBuilder();
        appendIfNotBlank(sb, "寒热", supplementary.getColdHeat());
        appendIfNotBlank(sb, "汗出", supplementary.getSweating());
        appendIfNotBlank(sb, "大便", supplementary.getBowel());
        appendIfNotBlank(sb, "小便", supplementary.getUrine());
        appendIfNotBlank(sb, "睡眠", supplementary.getSleep());
        appendIfNotBlank(sb, "口味", supplementary.getTaste());
        appendIfNotBlank(sb, "面色", supplementary.getComplexion());
        return sb.toString();
    }

    private String inferPrimarySyndrome(String evidence) {
        if (evidence.contains("口苦") || evidence.contains("急躁") || evidence.contains("胁") || evidence.contains("目赤") || evidence.contains("舌红")) {
            return "肝郁化火证";
        }
        if (evidence.contains("痰") || evidence.contains("胸闷") || evidence.contains("苔腻") || evidence.contains("湿")) {
            return "痰湿内阻证";
        }
        if (evidence.contains("腹胀") || evidence.contains("便溏") || evidence.contains("乏力") || evidence.contains("纳差") || evidence.contains("脾")) {
            return "脾虚湿困证";
        }
        if (evidence.contains("怕冷") || evidence.contains("畏寒") || evidence.contains("冷痛") || evidence.contains("阳虚")) {
            return "阳虚寒凝证";
        }
        if (evidence.contains("口干") || evidence.contains("盗汗") || evidence.contains("五心烦热") || evidence.contains("阴虚")) {
            return "阴虚内热证";
        }
        return "资料不足，倾向气机失调证";
    }

    private String inferSecondarySyndrome(String evidence, String primary) {
        if (!primary.contains("脾") && (evidence.contains("腹胀") || evidence.contains("便溏") || evidence.contains("纳差"))) return "脾胃失和";
        if (!primary.contains("痰湿") && (evidence.contains("痰") || evidence.contains("苔腻") || evidence.contains("湿"))) return "痰湿夹杂";
        if (!primary.contains("阴虚") && (evidence.contains("口干") || evidence.contains("盗汗"))) return "津液不足";
        return "";
    }

    private String inferTreatmentMethod(String primary, String secondary) {
        if (primary.contains("肝郁化火")) return "疏肝解郁，清泻郁热，兼顾和胃安神";
        if (primary.contains("痰湿")) return "化痰祛湿，理气和中";
        if (primary.contains("脾虚")) return "健脾益气，化湿和中";
        if (primary.contains("阳虚")) return "温阳散寒，通络止痛";
        if (primary.contains("阴虚")) return "滋阴清热，养津安神";
        return "调畅气机，和中扶正，结合后续四诊信息辨证加减";
    }

    private String inferFormula(String primary) {
        if (primary.contains("肝郁化火")) return "丹栀逍遥散类方加减方向";
        if (primary.contains("痰湿")) return "二陈汤合平胃散类方加减方向";
        if (primary.contains("脾虚")) return "参苓白术散类方加减方向";
        if (primary.contains("阳虚")) return "理中汤或温阳散寒类方加减方向";
        if (primary.contains("阴虚")) return "知柏地黄丸或养阴清热类方加减方向";
        return "需补充舌脉后再确定方剂方向";
    }

    private List<String> inferAcupoints(String primary) {
        if (primary.contains("肝")) return List.of("太冲", "期门", "阳陵泉", "内关");
        if (primary.contains("脾") || primary.contains("痰湿")) return List.of("足三里", "阴陵泉", "中脘", "丰隆");
        if (primary.contains("阳虚")) return List.of("关元", "气海", "命门", "足三里");
        if (primary.contains("阴虚")) return List.of("太溪", "三阴交", "照海", "内关");
        return List.of("足三里", "内关", "三阴交");
    }

    private boolean isInvalidAiDiagnosisText(String text) {
        if (text == null || text.isBlank()) return true;
        String trimmed = text.trim();
        long chineseCount = trimmed.chars().filter(ch -> ch >= 0x4E00 && ch <= 0x9FFF).count();
        double chineseRatio = chineseCount * 1.0 / Math.max(1, trimmed.length());
        return trimmed.contains("</think>")
                || trimmed.contains("Ċ")
                || trimmed.contains("Ġ")
                || trimmed.contains("<html")
                || trimmed.contains("HTML")
                || trimmed.matches(".*[A-Z]{1,4}[0-9]{1,3}[A-Z]{1,4}[0-9]{1,3}.*")
                || (trimmed.length() > 20 && chineseRatio < 0.25);
    }

    private String previewText(String text) {
        if (text == null) return "NULL";
        String oneLine = text.replaceAll("\\s+", " ").trim();
        return oneLine.substring(0, Math.min(120, oneLine.length()));
    }

    private void ensureClinicallyUsefulStructure(Map<String, Object> result,
                                                 List<WizardSymptomAssessment> assessments,
                                                 List<WizardMeridianCollection> meridians,
                                                 List<WizardDurationRecord> durations) {
        String primary = extractStringField(result, "primarySyndrome");
        String full = extractStringField(result, "fullAnalysis");

        // 当 primarySyndrome 或 treatmentMethod 为空时，尝试从 fullAnalysis 文本中提取
        if (primary.isBlank()) {
            String extractedPrimary = extractFromText(full,
                new String[]{"主证[型：:]\\s*", "主证\\s*[：:]\\s*", "primarySyndrome[：:]\\s*"});
            if (!extractedPrimary.isBlank()) {
                result.put("primarySyndrome", extractedPrimary);
                log.info("从文本中回退提取 primarySyndrome: {}", extractedPrimary);
            }
        }

        String treatment = extractStringField(result, "treatmentMethod");
        if (treatment.isBlank()) {
            String extractedTreatment = extractFromText(full,
                new String[]{"治法[：:]\\s*", "治疗原则[：:]\\s*", "treatmentMethod[：:]\\s*"});
            if (!extractedTreatment.isBlank()) {
                result.put("treatmentMethod", extractedTreatment);
                log.info("从文本中回退提取 treatmentMethod: {}", extractedTreatment);
            }
        }

        String secondary = extractStringField(result, "secondarySyndromes");
        if (secondary.isBlank()) {
            String extractedSecondary = extractFromText(full,
                new String[]{"兼[夹]?证[型：:]\\s*", "兼证\\s*[：:]\\s*", "secondarySyndromes[：:]\\s*"});
            if (!extractedSecondary.isBlank()) {
                result.put("secondarySyndromes", extractedSecondary);
            }
        }

        // 中医辨证核心原则：兼证依附于主证，无主证则兼证无所依附。
        // 当主证为空但兼证有内容时，必须将兼证提升为主证（那个"兼证"实际上就是主证）。
        primary = extractStringField(result, "primarySyndrome");
        secondary = extractStringField(result, "secondarySyndromes");
        if ((primary.isBlank() || isInvalidAiDiagnosisText(primary)) && !secondary.isBlank()) {
            log.warn("AI返回主证为空但兼证有内容（不合理），将兼证提升为主证: secondary={}", secondary);
            result.put("primarySyndrome", secondary);
            result.put("secondarySyndromes", "");
        }

        primary = extractStringField(result, "primarySyndrome");
        if (isInvalidAiDiagnosisText(full) || primary.isBlank() || isInvalidAiDiagnosisText(primary)) {
            log.warn("AI诊断结果结构不完整: primary={}, full={}", primary, previewText(full));
        }
    }

    /**
     * 从AI全文响应中按候选模式提取字段值（取第一个非空行内容）
     */
    private String extractFromText(String fullText, String[] patterns) {
        if (fullText == null || fullText.isBlank()) return "";
        for (String pattern : patterns) {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile(pattern + "(.+)").matcher(fullText);
            if (m.find()) {
                String value = m.group(1).trim();
                // 去掉尾部可能的标点或引号
                value = value.replaceAll("[\"'，。、；]$", "").trim();
                if (!value.isBlank() && value.length() >= 2 && value.length() <= 60) {
                    return value;
                }
            }
        }
        return "";
    }

    /**
     * 规则引擎已移除。AI 不可用时直接抛出异常，不再返回硬编码内容。
     */


    /**
     * 清洗本地/云端模型偶发的思维链标签、BPE残留符号与Markdown代码块，防止乱码进入前端和PDF。
     */
    private String sanitizeAiText(String text) {
        if (text == null) return "";
        String cleaned = text
                .replace("Ċ", "\n")
                .replace("Ġ", " ")
                .replace("▁", " ")
                .replaceAll("(?is)<think>.*?</think>", "")
                .replace("</think>", "")
                .replace("<think>", "")
                .replaceAll("(?i)```\\s*json", "```")
                .replaceAll("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]", "")
                .replaceAll("(?m)^\\s*JSON\\s*(?=\\{)", "")
                .trim();
        if (cleaned.startsWith("```") && cleaned.endsWith("```")) {
            cleaned = cleaned.replaceAll("^```\\s*", "").replaceAll("\\s*```$", "").trim();
        }
        return cleaned;
    }

    private String extractJsonObject(String text) {
        if (text == null) return "";
        String cleaned = sanitizeAiText(text);
        int fence = cleaned.indexOf("```");
        if (fence >= 0) {
            int bodyStart = fence + 3;
            int bodyEnd = cleaned.indexOf("```", bodyStart);
            if (bodyEnd > bodyStart) {
                String fenced = cleaned.substring(bodyStart, bodyEnd).trim();
                if (fenced.startsWith("{")) return fenced;
            }
        }
        int objStart = cleaned.indexOf('{');
        int objEnd = cleaned.lastIndexOf('}');
        if (objStart >= 0 && objEnd > objStart) return cleaned.substring(objStart, objEnd + 1).trim();
        return cleaned;
    }

    private String safeSyndrome(String value, String fallback) {
        String v = sanitizeAiText(value);
        return (v == null || v.isBlank() || isInvalidAiDiagnosisText(v)) ? fallback : v;
    }

    /** 规则引擎已移除。 */

    /** 规则引擎已移除。 */

    /** 规则引擎已移除。 */

    private String translateFollowupOutcome(String overallEvaluation) {
        if (overallEvaluation == null || overallEvaluation.isBlank()) return "未提供整体疗效";
        return overallEvaluation;
    }

    private String buildEvidenceText(List<WizardSymptomAssessment> assessments,
                                     List<WizardMeridianCollection> meridians,
                                     List<WizardDurationRecord> durations) {
        StringBuilder sb = new StringBuilder();
        for (WizardSymptomAssessment a : assessments) sb.append(a.getSymptomName()).append(' ').append(a.getSeverity()).append(' ');
        for (WizardMeridianCollection m : meridians) sb.append(m.getSymptomName()).append(' ').append(m.getAttackMeridian()).append(' ').append(m.getTongueBody()).append(' ').append(m.getTongueCoating()).append(' ').append(m.getPulseType()).append(' ').append(m.getBodyType()).append(' ').append(m.getEnvironmentFactors()).append(' ');
        for (WizardDurationRecord d : durations) sb.append(d.getSymptomName()).append(' ').append(d.getLiuJingStage()).append(' ');
        return sb.toString();
    }

    private String buildFourDiagnosticSummary(List<WizardSymptomAssessment> assessments,
                                              List<WizardMeridianCollection> meridians,
                                              List<WizardDurationRecord> durations) {
        String symptoms = assessments.stream().map(a -> a.getSymptomName() + (a.getSeverity() != null ? "（" + a.getSeverity() + "）" : "")).collect(Collectors.joining("、"));
        String tonguePulse = "";
        if (!meridians.isEmpty()) {
            WizardMeridianCollection first = meridians.get(0);
            List<String> parts = new ArrayList<>();
            if (first.getTongueBody() != null && !first.getTongueBody().isBlank()) parts.add("舌体" + first.getTongueBody());
            if (first.getTongueCoating() != null && !first.getTongueCoating().isBlank()) parts.add("舌苔" + first.getTongueCoating());
            if (first.getPulseType() != null && !first.getPulseType().isBlank()) parts.add("脉象" + first.getPulseType());
            tonguePulse = String.join("，", parts);
        }
        String durationText = durations.isEmpty() ? "病程资料未充分记录" : durations.stream().map(d -> d.getSymptomName() + "持续" + (d.getDurationDays() != null ? d.getDurationDays() + "天" : "未详") + (d.getLiuJingStage() != null ? "，阶段" + d.getLiuJingStage() : "")).collect(Collectors.joining("；"));
        return "已采集症状：" + (symptoms.isBlank() ? "未详" : symptoms) + "。" +
                (tonguePulse.isBlank() ? "舌象、脉象资料不足，建议补充。" : tonguePulse + "。") +
                "病程：" + durationText + "。闻诊、按诊及部分十问资料仍需面诊补充。";
    }

    private String buildCombinedAnalysis(String primary, String secondary) {
        if (secondary == null || secondary.isBlank() || secondary.startsWith("未见")) {
            return "当前以" + primary + "为主，暂未形成证据充分的典型合病；但仍需结合舌脉、二便、寒热汗出复核是否存在兼夹证。";
        }
        return "当前可按主次处理：以" + primary + "为本次辨证核心，兼顾" + secondary + "。合方思路应遵循主方为君、兼证加减为佐，避免多方堆砌。";
    }

    private String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ");
    }

    /**
     * 解析AI响应为结构化数据
     */
    private Map<String, Object> parseAiResponseToStructure(String aiResponse) {
        Map<String, Object> result = new LinkedHashMap<>();
        aiResponse = sanitizeAiText(aiResponse);

        // 尝试从AI响应中提取JSON块
        String jsonBlock = extractJsonBlock(aiResponse);
        if (jsonBlock != null) {
            try {
                Map<String, Object> parsed = objectMapper.readValue(jsonBlock,
                        new TypeReference<Map<String, Object>>() {});
                result.putAll(parsed);
            } catch (JsonProcessingException e) {
                log.warn("解析AI响应中的JSON块失败: {}", e.getMessage());
            }
        }

        // 无论JSON是否解析成功，保存完整的原始响应
        result.put("fullAnalysis", aiResponse);

        // 确保关键字段有默认值
        result.putIfAbsent("primarySyndrome", "");
        result.putIfAbsent("secondarySyndromes", "");
        result.putIfAbsent("treatmentMethod", "");
        result.putIfAbsent("confidenceScore", 0.7);

        return result;
    }

    /**
     * 从文本中提取```json ... ```块
     */
    private String extractJsonBlock(String text) {
        String json = extractJsonObject(text);
        return json == null || json.isBlank() ? null : json;
    }

    /**
     * 从结构化结果中提取字符串字段
     */
    private String extractStringField(Map<String, Object> structuredResult, String field) {
        Object value = structuredResult.get(field);
        if (value == null) return "";
        return value.toString();
    }

    /**
     * 从结构化结果中提取置信度分数
     */
    private Double extractConfidenceScore(Map<String, Object> structuredResult) {
        Object value = structuredResult.get("confidenceScore");
        if (value == null) return 0.7;
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return 0.7;
        }
    }

    /**
     * 调用AI生成合病合方推荐
     */
    private String generateCombinedFormulaRecommendation(String primarySyndrome,
                                                          String secondarySyndromes,
                                                          String combinedSyndromes) {
        String prompt = String.format(
                "基于以下辨证结果，请分析合病合方方案：\n\n" +
                "主证型：%s\n" +
                "兼夹证型：%s\n" +
                "合并证型：%s\n\n" +
                "请给出：\n" +
                "1. 合病分析（各证型之间的关联）\n" +
                "2. 合方推荐（推荐方剂组合，说明配伍意义）\n" +
                "3. 加减化裁建议\n" +
                "4. 通俗化解读（用大白话解释：这些证型之间是怎么互相影响的、为什么需要几个方子一起用）\n" +
                "请用JSON格式返回：{\"analysis\":\"分析内容\",\"formula\":\"合方推荐\",\"modification\":\"加减建议\"}",
                primarySyndrome != null ? primarySyndrome : "未知",
                secondarySyndromes != null ? secondarySyndromes : "无",
                combinedSyndromes != null ? combinedSyndromes : "无"
        );

        if (!deepSeekService.isCloudConfigured()) {
            throw new CustomException("AI服务未配置，无法生成合方推荐。");
        }
        return deepSeekService.chatWithHistory(
                DeepSeekService.TCM_DIAGNOSIS_SYSTEM_PROMPT, prompt, null);
    }

    /**
     * 调用AI生成疗效评估调整方案
     */
    private String generateAdjustedPlan(String originalDiagnosis,
                                         List<WizardSymptomAssessment> originalSymptoms,
                                         String overallEvaluation,
                                         String symptomEvaluations,
                                         String feedback,
                                         WizardCombinedFormula combinedFormula) {
        String originalSymptomList = originalSymptoms.stream()
                .map(s -> s.getSymptomName() + "(" + (s.getSeverity() != null ? s.getSeverity() : "未评估") + ")")
                .collect(Collectors.joining("、"));

        // 构建合方上下文
        String combinedContext = "";
        if (combinedFormula != null && combinedFormula.getIsApplied() != null && combinedFormula.getIsApplied()) {
            combinedContext = "\n【重要】患者已采纳合方治疗方案";
            if (combinedFormula.getRecommendedFormula() != null && !combinedFormula.getRecommendedFormula().isBlank()) {
                combinedContext += "，合方为：" + combinedFormula.getRecommendedFormula();
            }
            if (combinedFormula.getCombinedSyndromes() != null && !combinedFormula.getCombinedSyndromes().isBlank()) {
                combinedContext += "。合并证型：" + combinedFormula.getCombinedSyndromes();
            }
            combinedContext += "。请在评估时考虑合方的整体疗效，而非仅评估主证。\n";
        }

        String prompt = String.format(
                "【复诊模式】请根据以下疗效反馈，调整治疗方案：\n\n" +
                "原始诊断：\n%s\n\n" +
                "原始症状：%s\n%s\n" +
                "整体疗效自评：%s\n" +
                "各症状评估：%s\n" +
                "患者反馈：%s\n\n" +
                "请给出（控制在800字以内，确保内容完整不截断）：\n" +
                "1. 疗效评估（简要对比分析）\n" +
                "2. 调整后的治疗方案（方药调整、针灸穴位调整等）\n" +
                "3. 下一步建议\n" +
                "4. 通俗化解读（用大白话总结：治疗有没有效果、哪些症状改善了、接下来怎么做）\n" +
                "【重要】输出必须在结尾处自然收束，不要在句子中间截断。",
                originalDiagnosis != null ? originalDiagnosis : "无",
                originalSymptomList,
                combinedContext,
                overallEvaluation != null ? overallEvaluation : "未提供",
                symptomEvaluations != null ? symptomEvaluations : "未提供",
                feedback != null ? feedback : "无"
        );

        return deepSeekService.chatWithHistory(
                DeepSeekService.TCM_DIAGNOSIS_SYSTEM_PROMPT, prompt, null);
    }

    /**
     * 调用AI一次性生成多流派会诊 + 最终方案（合并为一次调用避免超时）
     */
    private String generateConsultationAndPlan(List<WizardSymptomAssessment> symptoms,
                                                List<WizardMeridianCollection> meridians,
                                                String originalDiagnosis,
                                                WizardCombinedFormula combinedFormula) {
        String symptomList = symptoms.stream()
                .map(s -> {
                    String info = s.getSymptomName();
                    if (s.getSeverity() != null && !s.getSeverity().isBlank()) {
                        info += "(" + s.getSeverity() + ")";
                    }
                    return info;
                })
                .collect(Collectors.joining("、"));

        String meridianInfo = "";
        if (!meridians.isEmpty()) {
            meridianInfo = "\n子午归经信息：" + meridians.stream()
                    .map(m -> m.getSymptomName() + " 发作于" +
                            (m.getAttackTime() != null ? m.getAttackTime() : "未记录") +
                            " 归" + (m.getAttackMeridian() != null ? m.getAttackMeridian() : "未定"))
                    .collect(Collectors.joining("；"));
        }

        // 构建合方上下文
        String combinedContext = "";
        if (combinedFormula != null && combinedFormula.getIsApplied() != null && combinedFormula.getIsApplied()) {
            combinedContext = "\n【重要背景】患者已采纳合方治疗方案";
            if (combinedFormula.getRecommendedFormula() != null && !combinedFormula.getRecommendedFormula().isBlank()) {
                combinedContext += "，当前合方：" + combinedFormula.getRecommendedFormula();
            }
            combinedContext += "。请各流派在分析时评价此合方是否合理，是否需要调整。\n";
        }

        String prompt = String.format(
                "【多流派会诊】请从多个中医学术流派对以下病例进行简明会诊：\n\n" +
                "症状：%s\n%s\n" +
                "原始诊断：\n%s\n%s\n" +
                "请依次简要分析（每个流派2-3句话，专业术语后紧跟括号内的大白话解释）：\n" +
                "1. 伤寒学派（六经辨证）：辨证、治法、方药\n" +
                "2. 温病学派（卫气营血辨证）：辨证、治法、方药\n" +
                "3. 脏腑辨证：辨证、治法、方药\n" +
                "4. 经络辨证：辨证、治法、方药\n\n" +
                "综合会诊意见：统一辨证结论和推荐方案。\n\n" +
                "===最终综合方案===\n" +
                "最终辨证、治法、主方及加减、针灸要点、食疗建议。\n" +
                "最后用一段大白话总结：综合各位专家的意见，你的问题是什么、应该怎么治、生活中注意什么。\n\n" +
                "【重要】请保留\"===最终综合方案===\"分隔标记。回复控制在1000字以内。",
                symptomList, meridianInfo,
                originalDiagnosis != null ? originalDiagnosis : "无",
                combinedContext
        );

        return deepSeekService.chatWithHistory(
                DeepSeekService.TCM_DIAGNOSIS_SYSTEM_PROMPT, prompt, null);
    }

    /**
     * 调用AI生成最终方案
     */
    private String generateFinalPlan(String consultationResults, String selectedSchool) {
        String prompt = String.format(
                "基于以下多流派会诊结果，请给出最终治疗方案：\n\n" +
                "会诊结果：\n%s\n\n" +
                "选择的主要流派：%s\n\n" +
                "请给出综合最终治疗方案，包含：\n" +
                "1. 最终辨证结论\n" +
                "2. 治法\n" +
                "3. 方药（主方及加减）\n" +
                "4. 针灸方案\n" +
                "5. 食疗调护建议\n" +
                "6. 随访建议\n" +
                "7. 通俗化解读（用大白话总结整个方案：你主要是什么问题、为什么用这个方子、生活中怎么调理）",
                consultationResults != null ? consultationResults : "无",
                selectedSchool != null && !selectedSchool.isBlank() ? selectedSchool : "综合各流派"
        );

        return deepSeekService.chatWithHistory(
                DeepSeekService.TCM_DIAGNOSIS_SYSTEM_PROMPT, prompt, null);
    }

    // ==================== 转换方法 ====================

    private SessionResponse toSessionResponse(WizardDiagnosisSession session) {
        return SessionResponse.builder()
                .id(session.getId())
                .patientName(session.getPatientName())
                .currentStep(session.getCurrentStep())
                .status(session.getStatus())
                .createdAt(session.getCreatedAt())
                .build();
    }

    private DiagnosisResponse toDiagnosisResponse(WizardAiDiagnosis diagnosis, Map<String, Object> structuredResult) {
        return DiagnosisResponse.builder()
                .id(diagnosis.getId())
                .primarySyndrome(diagnosis.getPrimarySyndrome())
                .secondarySyndromes(diagnosis.getSecondarySyndromes())
                .treatmentMethod(diagnosis.getTreatmentMethod())
                .confidenceScore(diagnosis.getConfidenceScore())
                .structuredResult(structuredResult)
                .rawAiResponse(diagnosis.getRawAiResponse())
                .build();
    }

    private SymptomDictItem toSymptomDictItem(WizardSymptomDict dict) {
        return SymptomDictItem.builder()
                .id(dict.getId())
                .name(dict.getName())
                .category(dict.getCategory())
                .isAssessable(dict.getIsAssessable())
                .build();
    }

    private OperationLogResponse toOperationLogResponse(WizardOperationLog logEntry) {
        return OperationLogResponse.builder()
                .id(logEntry.getId())
                .stepNo(logEntry.getStepNo())
                .operation(logEntry.getOperation())
                .fieldName(logEntry.getFieldName())
                .oldValue(logEntry.getOldValue())
                .newValue(logEntry.getNewValue())
                .createdAt(logEntry.getCreatedAt())
                .build();
    }

    // ==================== JSON工具方法 ====================

    private String toJsonString(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.error("序列化JSON失败", e);
            return null;
        }
    }

    private Map<String, Object> parseJsonToMap(String json) {
        if (json == null || json.isBlank()) return new LinkedHashMap<>();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            log.warn("解析JSON失败: {}", e.getMessage());
            return new LinkedHashMap<>();
        }
    }
}
