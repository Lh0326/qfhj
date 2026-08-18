/**
 * SmartTcm Auth API Client
 * Handles all authentication-related API calls to the backend.
 */

import apiData from '../../data/address.json';

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

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  avatar?: string;
  emailVerified: boolean;
  isActive: boolean;
  isSuperuser: boolean;
  language?: "zh" | "en";
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface LoginRequest {
  /** 支持 username 或 email 登录 */
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
  /** 注册验证码，邮箱验证通过后由后端下发 */
  code?: string;
  /** 语言设置：zh-中文（默认），en-英文 */
  language?: "zh" | "en";
}

export interface SendCodeRequest {
  email: string;
  /** 验证码类型：REGISTRATION | LOGIN | PASSWORD_RESET */
  type: "REGISTRATION" | "LOGIN" | "PASSWORD_RESET";
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
  type: "REGISTRATION" | "LOGIN" | "PASSWORD_RESET";
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface UpdateUserRequest {
  email?: string;
  fullName?: string;
  avatar?: string;
  /** 语言设置：zh-中文，en-英文 */
  language?: "zh" | "en";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function getToken(): string | null {
  return localStorage.getItem("smarttcm_access_token");
}

function setTokens(tokens: AuthTokens): void {
  localStorage.setItem("smarttcm_access_token", tokens.accessToken);
  if (tokens.refreshToken) {
    localStorage.setItem("smarttcm_refresh_token", tokens.refreshToken);
  }
  if (tokens.expiresIn) {
    localStorage.setItem(
      "smarttcm_token_expiry",
      String(Date.now() + tokens.expiresIn * 1000)
    );
  }
}

function clearTokens(): void {
  localStorage.removeItem("smarttcm_access_token");
  localStorage.removeItem("smarttcm_refresh_token");
  localStorage.removeItem("smarttcm_token_expiry");
}

async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  endpoint: string,
  body?: unknown,
  options: { useAuth?: boolean } = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.useAuth && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const fullUrl = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(fullUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await response.text();
    // 处理空响应体（如 401 返回 0 字节的情况）
    if (!responseText || responseText.trim().length === 0) {
      const apiError = new Error(`HTTP ${response.status}`) as Error & {
        code?: number;
        status: number;
      };
      apiError.status = response.status;
      throw apiError;
    }
    const json: ApiResponse<T> = JSON.parse(responseText);

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
  } catch (err) {
    console.error(`[API Error] ${method} ${fullUrl}:`, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

/**
 * 用户注册
 * POST /api/v1/auth/register
 */
export async function register(data: RegisterRequest): Promise<User> {
  return apiRequest<User>("POST", "/auth/register", data);
}

/**
 * 用户登录（支持 username 或 email）
 * POST /api/v1/auth/login
 */
export async function login(data: LoginRequest): Promise<AuthTokens & { user: User }> {
  const result = await apiRequest<AuthTokens & { user: User }>(
    "POST",
    "/auth/login",
    data
  );
  setTokens(result);
  return result;
}

/**
 * 发送邮箱验证码
 * POST /api/v1/auth/send-verification-code
 *
 * 后端逻辑：
 * - REGISTRATION: 已注册邮箱返回 "该邮箱已被注册"
 * - LOGIN / PASSWORD_RESET: 未注册邮箱返回 "该邮箱未注册"
 */
export async function sendVerificationCode(
  data: SendCodeRequest
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(
    "POST",
    "/auth/send-verification-code",
    data
  );
}

/**
 * 验证邮箱验证码
 * POST /api/v1/auth/verify-email
 */
export async function verifyCode(
  data: VerifyCodeRequest
): Promise<{ verified: boolean }> {
  await apiRequest<void>("POST", "/auth/verify-email", data);
  return { verified: true };
}

/**
 * 获取当前登录用户信息
 * GET /api/v1/auth/me
 */
export async function getCurrentUser(): Promise<User> {
  return apiRequest<User>("GET", "/auth/me", undefined, { useAuth: true });
}

/**
 * 更新当前用户信息
 * PUT /api/v1/auth/me
 */
export async function updateCurrentUser(
  data: UpdateUserRequest
): Promise<User> {
  return apiRequest<User>("PUT", "/auth/me", data, { useAuth: true });
}

/**
 * 修改密码
 * POST /api/v1/auth/change-password
 */
export async function changePassword(
  data: ChangePasswordRequest
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(
    "POST",
    "/auth/change-password",
    data,
    { useAuth: true }
  );
}

/**
 * 刷新访问令牌
 * POST /api/v1/auth/refresh
 */
export async function refreshToken(): Promise<AuthTokens> {
  clearTokens();
  throw new Error("当前后端未开放刷新令牌接口，请重新登录");
}

/**
 * 登出：当前后端未开放 logout 接口，前端只清理本地 token。
 */
export async function logout(): Promise<void> {
  clearTokens();
}

/**
 * 忘记密码 - 发送重置邮件
 * POST /api/v1/auth/forgot-password
 */
export async function forgotPassword(
  email: string
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("POST", "/auth/forgot-password", {
    email,
  });
}

/**
 * 重置密码（通过验证码）
 * POST /api/v1/auth/reset-password
 */
export async function resetPassword(
  email: string,
  token: string,
  newPassword: string
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("POST", "/auth/reset-password", {
    email,
    token,
    newPassword,
  });
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/**
 * 检查是否已登录（有有效 token）
 */
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;

  const expiry = localStorage.getItem("smarttcm_token_expiry");
  if (expiry && Date.now() > Number(expiry)) {
    // Token expired — try to refresh
    clearTokens();
    return false;
  }

  return true;
}

/**
 * 初始化认证状态：尝试用 refresh token 刷新，或拉取当前用户
 * 调用时机：应用启动时 AuthProvider 中
 */
export async function initAuth(): Promise<User | null> {
  if (!isAuthenticated()) return null;

  try {
    const user = await getCurrentUser();
    return user;
  } catch (err) {
    const error = err as Error & { status?: number };
    if (error.status === 401 || error.status === 403 || error.status === 500) {
      clearTokens();
      return null;
    }
    return null;
  }
}
