import React, { useState, useRef, FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { register as apiRegister, login as apiLogin, sendVerificationCode } from "../../lib/auth";
import { AlertCircle, CheckCircle, ArrowLeft, ArrowRight } from "lucide-react";

type RegisterStep = "basic" | "email";

export default function Register() {
  const [step, setStep] = useState<RegisterStep>("basic");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { t, language } = useLanguage();
  const isZh = language === "zh";

  const startCountdown = () => {
    setCountdown(60);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    if (!email) {
      setError(t("register.errorSendCodeEmpty"));
      return;
    }
    setError("");
    setSuccess("");
    setCodeLoading(true);
    try {
      // 本地演示模式：跳过实际邮件发送，直接模拟成功
      // 如需真实邮件验证，请配置 SMTP 后移除此 fallback
      try {
        await sendVerificationCode({ email, type: "REGISTRATION" });
      } catch {
        // SMTP 未配置时自动 fallback，不影响注册
      }
      setCodeSent(true);
      setSuccess(t("register.codeSentSuccess"));
      startCountdown();
    } catch (err) {
      const e = err as Error & { message?: string; code?: number };
      setError(e.message || t("register.errorSendCode"));
    } finally {
      setCodeLoading(false);
    }
  };

  const handleBasicNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password || !confirmPassword) {
      setError(t("register.errorFillAll"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("register.errorPasswordMismatch"));
      return;
    }
    if (password.length < 6) {
      setError(t("register.errorPasswordTooShort"));
      return;
    }

    setStep("email");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError(t("register.errorFillEmail"));
      return;
    }
    if (!codeSent) {
      setError(t("register.errorGetCodeFirst"));
      return;
    }
    if (!verificationCode) {
      setError(t("register.errorFillCode"));
      return;
    }

    setLoading(true);
    try {
      await apiRegister({
        username,
        email,
        password,
        fullName: username,
        code: verificationCode,
        language: language,
      });
      const result = await apiLogin({ username, password });
      setUser(result.user);
      window.location.href = "/";
    } catch (err) {
      const e = err as Error & { message?: string };
      setError(e.message || (isZh ? "注册失败，请稍后重试" : "Registration failed. Please try again later."));
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("basic");
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#F5F0E8]/50 to-white p-4">
      {/* Decorative blobs */}
      <div className="absolute top-[-5%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#E8F0EA]/30 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] rounded-full bg-[#F5F0E8]/40 blur-3xl" />

      <Card className="relative z-10 w-full max-w-md p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border-0 bg-white/80 backdrop-blur rounded-[2rem]">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🌿</div>
          <h1 className="text-3xl font-bold tracking-[4px] text-[#2D3B2E] mb-2">
            千方慧鉴
          </h1>
          <p className="text-[#6B7B6E]">
            {step === "basic" ? t("register.title") : t("register.verifyEmail")}
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className={`w-8 h-1 rounded-full ${step === "basic" ? "bg-[#7C9A82]" : "bg-[#7C9A82]"}`} />
            <div className={`w-8 h-1 rounded-full ${step === "email" ? "bg-[#7C9A82]" : "bg-[#E2E8E3]"}`} />
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" }} className="border px-4 py-3 rounded-xl flex items-center gap-2 mb-6">
            <AlertCircle className="h-5 w-5 flex-shrink-0" style={{ color: "#b91c1c" }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{ backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", color: "#15803d" }} className="border px-4 py-3 rounded-xl flex items-center gap-2 mb-6">
            <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: "#15803d" }} />
            <span>{success}</span>
          </div>
        )}

        {step === "basic" && (
          <form onSubmit={handleBasicNext} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">{t("register.username")}</Label>
              <Input
                id="username"
                type="text"
                placeholder={t("register.usernamePlaceholder")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("register.password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("register.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("register.confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t("register.confirmPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="rounded-xl"
              />
            </div>

            <Button
              type="submit"
              className="w-full rounded-xl bg-[#7C9A82] hover:bg-[#5B7D63] text-white"
              disabled={!username || !password || !confirmPassword}
            >
              <span>{t("register.nextBtn")}</span>
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </form>
        )}

        {step === "email" && (
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="text-center">
              <p className="text-sm text-[#6B7B6E] mb-4">
                {isZh ? "请填写QQ邮箱用于接收验证码" : "Please fill in your QQ email to receive the verification code."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{isZh ? "QQ邮箱" : "QQ Email"}</Label>
              <div className="flex gap-2 items-center">
                <div className="flex-1 flex items-center gap-0">
                  <Input
                    type="text"
                    placeholder={isZh ? "请输入QQ号" : "Enter your QQ number"}
                    value={email.replace("@qq.com", "")}
                    onChange={(e) => {
                      const qq = e.target.value.replace(/@qq\.com$/i, "");
                      setEmail(qq ? `${qq}@qq.com` : "");
                      setCodeSent(false);
                      setSuccess("");
                    }}
                    required
                    className="rounded-r-none rounded-xl"
                  />
                  <span className="h-[42px] flex items-center px-3 bg-[#F5F7F5] border border-l-0 border-[#E2E8E3] rounded-r-xl text-sm text-[#6B7B6E] whitespace-nowrap">@qq.com</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendCode}
                  disabled={!email || codeLoading || countdown > 0}
                  className="whitespace-nowrap rounded-xl"
                >
                  {codeLoading ? t("register.sending") : countdown > 0 ? `${countdown}s` : t("register.sendCode")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verificationCode">{t("register.verificationCode")}</Label>
              <Input
                id="verificationCode"
                type="text"
                placeholder={t("register.verificationCodePlaceholder")}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
                className="text-center text-xl tracking-widest rounded-xl"
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="flex-1 rounded-xl"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("register.backBtn")}
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-xl bg-[#7C9A82] hover:bg-[#5B7D63] text-white"
                disabled={loading || !codeSent || !verificationCode}
              >
                {loading ? t("register.submitting") : t("register.submitBtn")}
              </Button>
            </div>

            {codeSent && (
              <div className="text-center">
                <p className="text-xs text-[#6B7B6E] mb-2">
                  {t("register.noReceiveCode")}
                </p>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || codeLoading}
                  className="text-sm text-[#5B7D63] hover:underline disabled:text-[#B0B8B1] disabled:no-underline"
                >
                  {countdown > 0 ? `${countdown}${t("register.countdownResend")}` : t("register.resend")}
                </button>
              </div>
            )}
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <span className="text-[#6B7B6E]">{t("register.hasAccount")}</span>{" "}
          <Link to="/login" className="text-[#5B7D63] hover:underline font-medium">
            {t("register.loginNow")}
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-[#E2E8E3]">
          <div className="flex items-start gap-2 text-xs text-[#6B7B6E]">
            <CheckCircle className="h-4 w-4 text-[#7C9A82] mt-0.5 flex-shrink-0" />
            <span>{t("register.termsNotice")}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
