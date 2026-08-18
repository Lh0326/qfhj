/**
 * SmartTcm Admin API Client
 * Handles all superuser admin API calls.
 */

import apiData from "../../data/address.json";

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

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  avatar?: string;
  emailVerified: boolean;
  isActive: boolean;
  isSuperuser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminQuestion {
  id: number;
  questionType: string;
  content: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  difficulty?: string;
  competition?: string;
  yearStage?: string;
  questionCategory?: string;
  contentCategory?: string;
  knowledgePoint?: string;
  primaryProject?: string;
  secondaryProject?: string;
  textLevel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewsItem {
  id: number;
  title: string;
  content: string;
  source: string;
  sourceUrl: string;
  category: string;
  status: "raw" | "used" | "expired";
  publishedAt: string;
  createdAt: string;
}

export interface NewsStats {
  total: number;
  raw: number;
  used: number;
  expired: number;
}

export interface QuestionGenerateRequest {
  types: string[];
  topics?: string[];
  hskLevel?: string;
  count?: number;
}

export interface QuestionBatchItem {
  competition?: string;
  yearStage?: string;
  questionType: string;
  questionCategory?: string;
  content: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  difficulty?: string;
  contentCategory?: string;
  knowledgePoint?: string;
  primaryProject?: string;
  secondaryProject?: string;
  textLevel?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getToken(): string | null {
  return localStorage.getItem("smarttcm_access_token");
}

async function adminRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  endpoint: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      msg = err.message || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const json: ApiResponse<T> = await response.json();
  if (json.code && json.code !== 200 && json.code !== 0) {
    throw new Error(json.message || "API error");
  }
  return json.data;
}

// ---------------------------------------------------------------------------
// News API
// ---------------------------------------------------------------------------

export async function fetchNews(
  params?: { status?: string; category?: string; page?: number; size?: number }
): Promise<{ news: NewsItem[]; total: number; page: number; size: number }> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.category) sp.set("category", params.category);
  sp.set("page", String(params?.page ?? 0));
  sp.set("size", String(params?.size ?? 20));
  return adminRequest("GET", `/news?${sp.toString()}`);
}

export async function getNewsStats(): Promise<NewsStats> {
  return adminRequest("GET", "/news/stats");
}

export async function fetchHotNews(): Promise<NewsItem[]> {
  return adminRequest("POST", "/news/fetch", undefined);
}

export async function searchNews(keyword: string): Promise<NewsItem[]> {
  return adminRequest("POST", "/news/search", { keyword });
}

export async function updateNewsStatus(
  id: number,
  status: "raw" | "used" | "expired"
): Promise<NewsItem> {
  return adminRequest("PUT", `/news/${id}/status`, { status });
}

export async function deleteNews(id: number): Promise<void> {
  return adminRequest("DELETE", `/news/${id}`);
}

// ---------------------------------------------------------------------------
// Admin Questions API
// ---------------------------------------------------------------------------

export async function generateQuestionsFromNews(params?: {
  newsId?: number;
  count?: number;
  difficulty?: string;
  types?: string[];
}): Promise<AdminQuestion[]> {
  return adminRequest("POST", "/admin/questions/ai/generate-from-news", {
    newsId: params?.newsId,
    count: params?.count ?? 5,
    difficulty: params?.difficulty,
    types: params?.types,
  });
}

export async function generateQuestions(params: QuestionGenerateRequest): Promise<AdminQuestion[]> {
  return adminRequest("POST", "/admin/questions/ai/generate", {
    types: params.types,
    topics: params.topics,
    hskLevel: params.hskLevel,
    count: params.count ?? 5,
  });
}

export async function batchSaveQuestions(
  questions: QuestionBatchItem[]
): Promise<{ savedCount: number }> {
  return adminRequest("POST", "/admin/questions/batch", questions);
}

export async function getAdminQuestions(params?: {
  skip?: number;
  limit?: number;
  competition?: string;
  questionType?: string;
  questionCategory?: string;
  contentCategory?: string;
  searchText?: string;
}): Promise<{ questions: AdminQuestion[]; total: number; skip: number; limit: number }> {
  const sp = new URLSearchParams();
  sp.set("skip", String(params?.skip ?? 0));
  sp.set("limit", String(params?.limit ?? 100));
  if (params?.competition) sp.set("competition", params.competition);
  if (params?.questionType) sp.set("questionType", params.questionType);
  if (params?.questionCategory) sp.set("questionCategory", params.questionCategory);
  if (params?.contentCategory) sp.set("contentCategory", params.contentCategory);
  if (params?.searchText) sp.set("searchText", params.searchText);
  return adminRequest("GET", `/admin/questions?${sp.toString()}`);
}

export async function createQuestion(question: QuestionBatchItem): Promise<AdminQuestion> {
  return adminRequest("POST", "/admin/questions", question);
}

export async function updateQuestion(
  questionId: number,
  question: Partial<QuestionBatchItem>
): Promise<AdminQuestion> {
  return adminRequest("PUT", `/admin/questions/${questionId}`, question);
}

export async function deleteQuestion(questionId: number): Promise<void> {
  return adminRequest("DELETE", `/admin/questions/${questionId}`);
}

// ---------------------------------------------------------------------------
// Users API
// ---------------------------------------------------------------------------

export async function getAdminUsers(params?: {
  skip?: number;
  limit?: number;
}): Promise<AdminUser[]> {
  const sp = new URLSearchParams();
  sp.set("skip", String(params?.skip ?? 0));
  sp.set("limit", String(params?.limit ?? 100));
  return adminRequest("GET", `/users?${sp.toString()}`);
}

export async function getAdminUser(userId: number): Promise<AdminUser> {
  return adminRequest("GET", `/users/${userId}`);
}

export async function updateAdminUser(
  userId: number,
  data: {
    username?: string;
    email?: string;
    fullName?: string;
    password?: string;
    isActive?: boolean;
    isSuperuser?: boolean;
  }
): Promise<AdminUser> {
  return adminRequest("PUT", `/users/${userId}`, data);
}

export async function getAdminQuestionStats(): Promise<{ total: number }> {
  const data = await adminRequest<{ questions: AdminQuestion[]; total: number }>(
    "GET",
    "/admin/questions?skip=0&limit=1"
  );
  return { total: data.total };
}
