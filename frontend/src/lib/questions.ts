/**
 * SmartTcm Question Bank API Client
 * Handles all question/quiz-related API calls to the backend.
 */

import apiData from "../../data/address.json";
import { getToken } from "./auth";

const API_BASE_URL = apiData.apiBaseUrl;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  code?: number;
  success?: boolean;
  message: string;
  data: T;
}

// Question entity (full detail)
export interface Question {
  id: number;
  competition?: string;
  yearStage?: string;
  questionType?: string;
  questionCategory?: string;
  contentCategory?: string;
  question: string;
  options?: string;
  answer?: string;
  answerImageUrl?: string;
  questionImageUrl?: string;
  mediaUrl?: string;
  answerOnly?: string;
  knowledgePoint?: string;
  primaryProject?: string;
  secondaryProject?: string;
  culturalPoint?: string;
  fourStageCognition?: string;
  bloomCognitionLevel?: string;
  coreConnotation?: string;
  whyQuestion?: string;
  mainFocus?: string;
  textLevel?: string;
  createdAt: string;
  updatedAt: string;
}

// Lightweight question for quiz (no answer exposed)
export interface QuestionForQuiz {
  id: number;
  competition?: string;
  yearStage?: string;
  questionType?: string;
  questionCategory?: string;
  contentCategory?: string;
  question: string;
  options?: string;
  questionImageUrl?: string;
  mediaUrl?: string;
}

// Paginated list response
export interface QuestionListResponse {
  questions: Question[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Search response
export interface SearchResponse {
  questions: Question[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Category options for filters (knowledgePoints 已从 API 移除，不再包含在此类型中)
export interface CategoryOptions {
  competitions: string[];
  yearStages: string[];
  questionTypes: string[];
  questionCategories: string[];
  contentCategories: string[];
  primaryProjects: string[];
  secondaryProjects: string[];
}

// Question bank statistics
export interface QuestionStats {
  totalQuestions: number;
  categories: Record<string, number>;
}

// Neo4j knowledge graph DTOs
export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: string;
  description?: string;
  questionId?: number;
  count?: number;
}

export interface KnowledgeGraphLink {
  source: string;
  target: string;
  relation: string;
  weight?: number;
}

export interface KnowledgeGraphResponse {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
  questions: Question[];
  stats: Record<string, number>;
  source: string;
  message: string;
}

export interface KnowledgeGraphSyncResponse {
  requested: number;
  syncedQuestions: number;
  entityNodes: number;
  questionNodes: number;
  relationCount: number;
  message: string;
}

// Quiz answer check
export interface AnswerCheckRequest {
  questionId: number;
  userAnswer: string;
  answerTimeSeconds?: number;
}

export interface AnswerCheckResult {
  questionId: number;
  userAnswer: string;
  correctAnswer: string;
  answerOnly?: string;
  isCorrect: boolean;
  explanation?: string;
}

// Question explanation / detailed analysis
export interface QuestionExplanation {
  questionId: number;
  question: string;
  correctAnswer: string;
  answerOnly?: string;
  knowledgePoint?: string;
  primaryProject?: string;
  secondaryProject?: string;
  culturalPoint?: string;
  fourStageCognition?: string;
  bloomCognitionLevel?: string;
  coreConnotation?: string;
  whyQuestion?: string;
  mainFocus?: string;
  textLevel?: string;
}

// Request query params
export interface GetQuestionsParams {
  skip?: number;
  limit?: number;
  competition?: string;
  yearStage?: string;
  questionType?: string;
  questionCategory?: string;
  contentCategory?: string;
  primaryProject?: string;
  secondaryProject?: string;
  searchText?: string;
}

export interface SearchQuestionsParams {
  q: string;
  skip?: number;
  limit?: number;
}

export interface GetRandomQuizParams {
  competition?: string;
  questionCategory?: string;
  contentCategory?: string;
  primaryProject?: string;
  secondaryProject?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  endpoint: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  // 401 — token 过期，尝试刷新后重试
  if (response.status === 401) {
    try {
      const refreshTokenValue = localStorage.getItem("smarttcm_refresh_token");
      if (refreshTokenValue) {
        const refreshResult = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: refreshTokenValue }),
          credentials: "include",
        });
        if (refreshResult.ok) {
          const json: { success?: boolean; code?: number; data?: { accessToken: string; refreshToken: string; expiresIn?: number } } = await refreshResult.json();
          if (json.success !== false && json.data?.accessToken) {
            const newToken = json.data.accessToken;
            if (json.data.refreshToken) localStorage.setItem("smarttcm_refresh_token", json.data.refreshToken);
            if (json.data.expiresIn) localStorage.setItem("smarttcm_token_expiry", String(Date.now() + json.data.expiresIn * 1000));
            localStorage.setItem("smarttcm_access_token", newToken);
            headers["Authorization"] = `Bearer ${newToken}`;
            const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
              method,
              headers,
              body: body ? JSON.stringify(body) : undefined,
              credentials: "include",
            });
            if (!retryResponse.ok) {
              const errorMessage = `HTTP ${retryResponse.status}`;
              const error = new Error(errorMessage) as Error & { status: number };
              error.status = retryResponse.status;
              throw error;
            }
            if (retryResponse.status === 204) return {} as T;
            const retryJson: ApiResponse<T> = await retryResponse.json();
            const isSuccess = retryJson.success === true || retryJson.code === 0 || retryJson.code === 200;
            if (!isSuccess) {
              const apiError = new Error(retryJson.message || "API error") as Error & { code?: number; status: number };
              apiError.code = retryJson.code;
              apiError.status = retryResponse.status;
              throw apiError;
            }
            return retryJson.data;
          }
        }
      }
    } catch {
      // 刷新失败，降级处理
    }
    // 刷新失败或无 refreshToken，按普通 401 处理
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch { /* ignore */ }
    const error = new Error(errorMessage) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      // ignore parse error
    }
    const error = new Error(errorMessage) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return {} as T;
  }

  const json: ApiResponse<T> = await response.json();

  const isSuccess = json.success === true || json.code === 0 || json.code === 200;
  if (!isSuccess) {
    const apiError = new Error(json.message || "API error") as Error & {
      code?: number;
      status: number;
    };
    apiError.code = json.code;
    apiError.status = response.status;
    throw apiError;
  }

  return json.data;
}

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
}

// ---------------------------------------------------------------------------
// Question Bank API (QuestionController)
// ---------------------------------------------------------------------------

/**
 * 获取题目列表（分页+筛选）
 * GET /api/v1/questions/questions
 */
export async function getQuestions(
  params: GetQuestionsParams = {}
): Promise<QuestionListResponse> {
  const qs = buildQueryString(params as Record<string, unknown>);
  return apiRequest<QuestionListResponse>("GET", `/questions/questions${qs}`);
}

/**
 * 获取题目详情
 * GET /api/v1/questions/questions/{questionId}
 */
export async function getQuestionDetail(
  questionId: number
): Promise<Question> {
  return apiRequest<Question>("GET", `/questions/questions/${questionId}`);
}

/**
 * 获取分类选项列表（供前端筛选器使用）
 * GET /api/v1/questions/categories
 *
 * 注意：API 返回的 yearStages 和 contentCategories 可能是逗号/分号拼接的原始值，
 * 此函数会自动拆分、去重、排序，保证 options 数组格式一致。
 */
export async function getCategoryOptions(): Promise<CategoryOptions> {
  const raw: Record<string, unknown> = await apiRequest(
    "GET",
    "/questions/categories"
  );

  function normalize(val: unknown): string[] {
    if (!val) return [];
    if (Array.isArray(val)) {
      return [...new Set(val.map(String).filter(Boolean))].sort();
    }
    // 尝试按逗号或分号拆分
    const parts = String(val).split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    return [...new Set(parts)].sort();
  }

  return {
    competitions: normalize(raw.competitions),
    yearStages: normalize(raw.yearStages),
    questionTypes: normalize(raw.questionTypes),
    questionCategories: normalize(raw.questionCategories),
    contentCategories: normalize(raw.contentCategories),
    primaryProjects: normalize(raw.primaryProjects),
    secondaryProjects: normalize(raw.secondaryProjects),
  };
}

/**
 * 搜索题目
 * GET /api/v1/questions/search
 */
export async function searchQuestions(
  params: SearchQuestionsParams
): Promise<SearchResponse> {
  const qs = buildQueryString(params as Record<string, unknown>);
  return apiRequest<SearchResponse>("GET", `/questions/search${qs}`);
}

/**
 * 获取题库统计信息
 * GET /api/v1/questions/stats
 */
export async function getQuestionStats(): Promise<QuestionStats> {
  return apiRequest<QuestionStats>("GET", "/questions/stats");
}

/**
 * 获取 Neo4j 知识图谱概览
 * GET /api/v1/questions/graph/overview
 */
export async function getKnowledgeGraphOverview(params: { q?: string; limit?: number } = {}): Promise<KnowledgeGraphResponse> {
  const qs = buildQueryString(params as Record<string, unknown>);
  return apiRequest<KnowledgeGraphResponse>("GET", `/questions/graph/overview${qs}`);
}

/**
 * 获取单条知识的 Neo4j 关联图谱
 * GET /api/v1/questions/graph/question/{questionId}
 */
export async function getQuestionKnowledgeGraph(questionId: number): Promise<KnowledgeGraphResponse> {
  return apiRequest<KnowledgeGraphResponse>("GET", `/questions/graph/question/${questionId}`);
}

/**
 * 手动同步 MySQL 知识库到 Neo4j
 * POST /api/v1/questions/graph/sync
 */
export async function syncKnowledgeGraph(limit = 500): Promise<KnowledgeGraphSyncResponse> {
  return apiRequest<KnowledgeGraphSyncResponse>("POST", `/questions/graph/sync?limit=${encodeURIComponent(String(limit))}`);
}

// ---------------------------------------------------------------------------
// Quiz API (QuizController)
// ---------------------------------------------------------------------------

/**
 * 获取随机题目（用于测验，隐藏答案）
 * POST /api/v1/questions/quiz/random
 */
export async function getRandomQuiz(
  params: GetRandomQuizParams = {}
): Promise<QuestionForQuiz[]> {
  // questionTypeCounts 可以单独传入，也可以从外部传入
  // 此函数不传 questionTypeCounts，由调用方构造完整请求体
  const body: Record<string, unknown> = { ...params };
  return apiRequest<QuestionForQuiz[]>("POST", "/questions/quiz/random", body);
}

/**
 * 按题型配置获取随机题目
 * POST /api/v1/questions/quiz/random
 * @param questionTypeCounts 各题型数量映射，如 { "选择题": 5, "填空题": 3 }
 * @param otherFilters 其他筛选条件
 */
export async function getRandomQuizByTypes(
  questionTypeCounts: Record<string, number>,
  otherFilters: GetRandomQuizParams = {}
): Promise<QuestionForQuiz[]> {
  const body = {
    questionTypeCounts,
    ...otherFilters,
  };
  return apiRequest<QuestionForQuiz[]>("POST", "/questions/quiz/random", body);
}

/**
 * 获取单个答题题目（隐藏答案）
 * GET /api/v1/questions/quiz/question/{questionId}
 */
export async function getQuizQuestion(
  questionId: number
): Promise<QuestionForQuiz> {
  return apiRequest<QuestionForQuiz>("GET", `/questions/quiz/question/${questionId}`);
}

/**
 * 检查答案
 * POST /api/v1/questions/quiz/check-answer
 */
export async function checkAnswer(
  data: AnswerCheckRequest
): Promise<AnswerCheckResult> {
  return apiRequest<AnswerCheckResult>("POST", "/questions/quiz/check-answer", data);
}

/**
 * 获取题目详细解析
 * GET /api/v1/questions/quiz/explanation/{questionId}
 */
export async function getQuestionExplanation(
  questionId: number
): Promise<QuestionExplanation> {
  return apiRequest<QuestionExplanation>(
    "GET",
    `/questions/quiz/explanation/${questionId}`
  );
}

/**
 * 批量检查答案
 * POST /api/v1/questions/quiz/batch-check
 */
export async function batchCheckAnswers(
  data: AnswerCheckRequest[]
): Promise<AnswerCheckResult[]> {
  return apiRequest<AnswerCheckResult[]>("POST", "/questions/quiz/batch-check", data);
}
