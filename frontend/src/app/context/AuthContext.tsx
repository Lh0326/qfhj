import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import logoUrl from "../../assets/qfhj-logo.png";
import {
  User,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  initAuth,
  isAuthenticated,
  getCurrentUser,
} from "../../lib/auth";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isSuperuser: boolean;
  loading: boolean;
  setUser: (user: User | null) => void;
  login: (username: string, password: string) => Promise<User>;
  register: (
    username: string,
    email: string,
    password: string,
    fullName: string,
    language?: "zh" | "en"
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function DemoLoginGate({ message, attempt }: { message: string; attempt: number }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#F5F0E7]/92 px-5 backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,154,130,0.24),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(224,168,58,0.20),transparent_30%),linear-gradient(135deg,rgba(91,125,99,0.16),rgba(245,240,231,0.72))]" />
      <div className="absolute left-10 top-10 h-28 w-28 rounded-full border border-[#7C9A82]/25" />
      <div className="absolute bottom-12 right-12 h-40 w-40 rounded-full border border-[#D6A957]/25" />

      <div className="relative w-full max-w-[520px] overflow-hidden rounded-[2rem] border border-white/70 bg-white/86 p-7 text-center shadow-[0_30px_90px_rgba(45,59,46,0.22)] ring-1 ring-[#7C9A82]/10">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#5B7D63] via-[#D6A957] to-[#8CA65A]" />
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-[1.6rem] bg-[#F5F0E7] p-2 shadow-inner ring-1 ring-[#7C9A82]/18">
          <img src={logoUrl} alt="千方慧鉴" className="h-full w-full rounded-[1.2rem] object-cover" />
        </div>

        <div className="mb-2 text-xs font-semibold tracking-[0.35em] text-[#8A6A1F]">QIANFANG HUIJIAN</div>
        <h2 className="text-2xl font-black tracking-tight text-[#223126]">正在进入千方慧鉴演示系统</h2>
        <p className="mx-auto mt-3 max-w-[390px] text-sm leading-7 text-[#5F6F61]">
          {message} 登录完成前页面将保持锁定，防止误触其它功能。
        </p>

        <div className="mx-auto mt-6 flex w-fit items-center gap-3 rounded-full border border-[#7C9A82]/18 bg-[#EEF4EC] px-4 py-2 text-sm font-semibold text-[#3F6148]">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7C9A82] opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#5B7D63]" />
          </span>
          自动登录中 · 第 {attempt} 次连接
        </div>

        <div className="mt-7 h-2 overflow-hidden rounded-full bg-[#E5DDCD]">
          <div className="h-full w-1/2 animate-[qfhj-login-progress_1.35s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#5B7D63] via-[#D6A957] to-[#7C9A82]" />
        </div>

        <p className="mt-5 text-xs leading-6 text-[#8A8F7A]">
          AI 中医问诊 · 知识图谱 · 皮肤病智能分析正在为评委演示环境预热
        </p>
      </div>
      <style>{`@keyframes qfhj-login-progress{0%{transform:translateX(-115%)}55%{transform:translateX(80%)}100%{transform:translateX(230%)}}`}</style>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoLoginAttempt, setAutoLoginAttempt] = useState(1);
  const [autoLoginMessage, setAutoLoginMessage] = useState("正在接入千方慧鉴演示账号，请稍候…");

  // 应用启动时，优先恢复登录状态；如果本地 token 失效，则持续自动登录默认演示账号。
  // 在成功前保持全屏弹窗遮罩，避免评委误点进入未授权页面。
  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    let attempt = 1;

    const loginDemoUser = async () => {
      // 清理旧 token
      await apiLogout();
      // 登录演示账号
      const loginResult = await apiLogin({ username: "admin", password: "admin123" });
      // 如果 login 响应已包含用户信息，直接使用；否则再请求 /auth/me
      if (loginResult && (loginResult as any).user) {
        return (loginResult as any).user as User;
      }
      return getCurrentUser();
    };

    const restore = async () => {
      if (cancelled) return;
      setLoading(true);
      setAutoLoginAttempt(attempt);

      try {
        if (isAuthenticated()) {
          setAutoLoginMessage("正在校验本地登录状态…");
          const currentUser = await initAuth();
          if (currentUser) {
            if (!cancelled) {
              setUser(currentUser);
              setLoading(false);
            }
            return;
          }
        }

        setAutoLoginMessage(attempt === 1 ? "正在登录评委演示账号…" : `登录服务仍在响应中，正在第 ${attempt} 次重试…`);
        const demoUser = await loginDemoUser();
        if (demoUser) {
          if (!cancelled) {
            setUser(demoUser);
            setAutoLoginMessage("登录成功，正在进入千方慧鉴…");
            setLoading(false);
          }
          return;
        }
        throw new Error("默认演示账号登录未返回用户信息");
      } catch (err) {
        console.error("[Auth] Auto-login failed:", err);
        await apiLogout();
        if (!cancelled) {
          setUser(null);
          setAutoLoginMessage("后端服务正在唤醒，系统将自动重试登录…");
          attempt += 1;
          retryTimer = window.setTimeout(restore, 1800);
        }
      }
    };

    restore();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, []);

  const login = async (username: string, password: string): Promise<User> => {
    await apiLogin({ username, password });
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    return currentUser;
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    fullName: string,
    language?: "zh" | "en"
  ): Promise<void> => {
    await apiRegister({ username, email, password, fullName, language });
    await apiLogin({ username, password });
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  };

  const logout = async (): Promise<void> => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      window.location.href = "/";
    }
  };

  const shouldShowLoginGate = loading || !user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isSuperuser: !!user?.isSuperuser,
        loading,
        setUser,
        login,
        register,
        logout,
      }}
    >
      {children}
      {shouldShowLoginGate && <DemoLoginGate message={autoLoginMessage} attempt={autoLoginAttempt} />}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
