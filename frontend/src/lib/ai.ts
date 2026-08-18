/**
 * SmartTcm AI Service
 * 后端 API 集成（通过 Spring Boot 后端调用 DeepSeek）
 */

import apiData from "../../data/address.json";

// API 基础路径
const API_BASE_URL = apiData.apiBaseUrl || "http://localhost:8080/api/v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIError {
  message: string;
  code?: string;
  status?: number;
}

// 获取存储的 token
function getAuthToken(): string | null {
  return localStorage.getItem("smarttcm_access_token");
}

// ---------------------------------------------------------------------------
// Core API Functions
// ---------------------------------------------------------------------------

/**
 * Send a chat message and get AI response
 * @param userMessage - The user's message
 * @param conversationHistory - Previous conversation messages (optional)
 */
export async function sendChatMessage(
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {

  // 转换历史消息格式（过滤 system 消息）
  const history = conversationHistory
    .filter((m) => m.role === "assistant" || m.role === "user")
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message: userMessage,
      history: history,
      stream: false,
    }),
  });

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
      console.error("[AI] API error response:", errorData);
    } catch {
      // ignore parse error
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || "AI 服务暂时不可用");
  }

  return data.content;
}

/**
 * Check if the API is configured (检查后端 AI 服务是否可用)
 */
export function isAIConfigured(): boolean {
  // 通过后端调用，不需要前端配置检查
  return true;
}

/**
 * Test API connection
 */
export async function testAIConnection(): Promise<boolean> {
  try {
    await sendChatMessage("你好", []);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Streaming API (for real-time responses)
// ---------------------------------------------------------------------------

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onComplete: () => void | Promise<void>;
  onError: (error: Error) => void;
  onRecommendedQuestions?: (questions: Array<{ id: number; score: number }>) => void;
}

export interface StreamOptions {
  signal?: AbortSignal;
}

/**
 * Send chat message with streaming response
 */
export async function sendChatMessageStream(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  callbacks: StreamCallbacks,
  options?: StreamOptions
): Promise<void> {
  // 转换历史消息格式（过滤 system 消息）
  const history = conversationHistory
    .filter((m) => m.role === "assistant" || m.role === "user")
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const token = getAuthToken();

  try {
    const response = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message: userMessage,
        history: history,
        stream: true,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("event:")) {
          // 提取事件名称
          currentEvent = trimmed.substring(6).trim();
          continue;
        }

        if (trimmed.startsWith("data:")) {
          const data = trimmed.substring(5).trim();

          // 处理完成事件
          if (currentEvent === "done" || data === "[DONE]" || data.includes('"done": true')) {
            callbacks.onComplete();
            return;
          }

          // 处理消息事件
          if (currentEvent === "message" || currentEvent === "") {
            try {
              const parsed = JSON.parse(data);
              const content = parsed.content || parsed.choices?.[0]?.delta?.content;
              if (content) {
                callbacks.onChunk(content);
              }
            } catch {
              // ignore parse errors for partial data
            }
          }

          // 处理错误事件
          if (currentEvent === "error") {
            try {
              const parsed = JSON.parse(data);
              callbacks.onError(new Error(parsed.error || "AI服务调用失败"));
              return;
            } catch {
              callbacks.onError(new Error("AI服务调用失败"));
              return;
            }
          }

          // 处理推荐题目事件
          if (currentEvent === "questions") {
            try {
              const parsed = JSON.parse(data);
              if (parsed.recommendedQuestions && callbacks.onRecommendedQuestions) {
                callbacks.onRecommendedQuestions(parsed.recommendedQuestions);
              }
            } catch {
              // ignore parse errors
            }
          }

          currentEvent = ""; // 重置事件状态
        }
      }
    }

    await Promise.resolve(callbacks.onComplete());
  } catch (error) {
    // If the request was aborted (user interrupted), don't call onError
    if ((error as Error).name === "AbortError") {
      return;
    }
    callbacks.onError(error as Error);
  }
}

// ---------------------------------------------------------------------------
// 以下是其他 AI 功能（题目生成、答案检查等）暂时保留原接口
// 如果这些功能也需要迁移到后端，可以添加对应的后端接口
// ---------------------------------------------------------------------------
