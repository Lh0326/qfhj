/**
 * SmartTcm Chat API Client
 * 对话管理 API 调用
 */

import apiData from "../../data/address.json";
import { getToken } from "./auth";

const API_BASE_URL = apiData.apiBaseUrl;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  recommendedQuestions?: Array<{
    questionId: number;
    score: number;
  }>;
  timestamp?: string;
}

export interface ChatConversation {
  id: number;
  userId: number;
  title: string;
  lastMessage?: string;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveConversationRequest {
  id?: number;
  title?: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    recommendedQuestions?: Array<{
      questionId: number;
      score: number;
    }>;
    timestamp?: string;
  }>;
}

export interface ConversationListData {
  items: ChatConversation[];
  total: number;
  page: number;
  size: number;
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

  // 401 — token 过期或未登录：清理本地 token，交由页面引导重新登录
  if (response.status === 401) {
    localStorage.removeItem("smarttcm_access_token");
    localStorage.removeItem("smarttcm_refresh_token");
    localStorage.removeItem("smarttcm_token_expiry");
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

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Chat API Functions
// ---------------------------------------------------------------------------

/**
 * 保存对话（创建或更新）
 * POST /api/v1/chat/conversations
 */
export async function saveConversation(
  data: SaveConversationRequest
): Promise<{ id: number; title?: string; updatedAt: string }> {
  const response = await apiRequest<{
    success: boolean;
    data?: { id: number; title?: string; updatedAt: string };
  }>(
    "POST",
    "/chat/conversations",
    data
  );
  if (response.data) {
    return response.data;
  }
  return response as unknown as { id: number; title?: string; updatedAt: string };
}

/**
 * 获取对话列表（分页）
 * GET /api/v1/chat/conversations?page=1&size=20
 */
export async function getConversationList(
  page = 1,
  size = 20
): Promise<ConversationListData> {
  const response = await apiRequest<{
    success: boolean;
    data?: ConversationListData;
  }>(
    "GET",
    `/chat/conversations?page=${page}&size=${size}`
  );
  // 返回 data 字段内的实际数据
  if (response.data) {
    return response.data;
  }
  // 降级：如果没有嵌套 data 结构，直接返回整个响应
  return response as unknown as ConversationListData;
}

/**
 * 获取对话详情
 * GET /api/v1/chat/conversations/{id}
 */
export async function getConversationDetail(
  conversationId: number
): Promise<ChatConversation & { messages: ChatMessage[] }> {
  const response = await apiRequest<{
    success: boolean;
    data?: ChatConversation & { messages: ChatMessage[] };
  }>(
    "GET",
    `/chat/conversations/${conversationId}`
  );
  // 返回 data 字段内的实际数据
  if (response.data) {
    return response.data;
  }
  // 降级
  return response as unknown as ChatConversation & { messages: ChatMessage[] };
}

/**
 * 删除对话
 * DELETE /api/v1/chat/conversations/{id}
 */
export async function deleteConversation(conversationId: number): Promise<void> {
  await apiRequest<void>(
    "DELETE",
    `/chat/conversations/${conversationId}`
  );
}
