import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { useLanguage } from "../../context/LanguageContext";
import { forgotPassword, resetPassword } from "../../lib/auth";
import { AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";

type ResetStep = "send-code" | "reset-password";

export default function ForgotPassword() {
  const [step, setStep] = useState<ResetStep>("send-code");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
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
      setError(isZh ? "请填写邮箱地址" : "Please fill in the email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("forgotPassword.errorInvalidEmail"));
      return;
    }
    setError("");
    setSuccess("");
    setCodeLoading(true);
    try {
      await forgotPassword(email);
      setCodeSent(true);
      setSuccess(t("forgotPassword.success"));
      startCountdown();
    } catch (err) {
      const e = err as Error & { message?: string };
      setError(e.message || t("forgotPassword.errorSendCode"));
    } finally {
      setCodeLoading(false);
    }
  };

  const handleNextToReset = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError(isZh ? "请填写邮箱地址" : "Please fill in the email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("forgotPassword.errorInvalidEmail"));
      return;
    }
    if (!codeSent) {
      setError(t("forgotPassword.errorGetCodeFirst"));
      return;
    }
    if (!token) {
      setError(t("forgotPassword.errorFillCode"));
      return;
    }

    setStep("reset-password");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newPassword) {
      setError(isZh ? "请填写新密码" : "Please fill in the new password.");
      return;
    }
    if (newPassword.length < 6) {
      setError(t("forgotPassword.errorPasswordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("forgotPassword.errorPasswordMismatch"));
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email, token, newPassword);
      setSuccess(t("forgotPassword.success"));
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      const e = err as Error & { message?: string };
      setError(e.message || t("forgotPassword.errorResetPassword"));
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("send-code");
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[#F5F0E8]/50 to-white relative">
      {/* Decorative blobs */}
      <div className="absolute top-[-5%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#E8F0EA]/30 blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[35%] h-[35%] rounded-full bg-[#F5F0E8]/40 blur-3xl" />

      <Card className="w-full max-w-md p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border-0 bg-white/80 backdrop-blur rounded-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🌿</div>
          <h1 className="text-3xl font-bold tracking-[4px] text-[#2D3B2E] mb-2">
            千方慧鉴
          </h1>
          <p className="text-[#6B7B6E]">
            {step === "send-code" ? t("forgotPassword.title") : t("forgotPassword.setNewPassword")}
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className={`w-8 h-1 rounded-full ${step === "send-code" ? "bg-[#7C9A82]" : "bg-[#7C9A82]"}`} />
            <div className={`w-8 h-1 rounded-full ${step === "reset-password" ? "bg-[#7C9A82]" : "bg-[#E2E8E3]"}`} />
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

        {step === "send-code" && (
          <form onSubmit={handleNextToReset} className="space-y-5">
            <div className="text-center">
              <p className="text-sm text-[#6B7B6E] mb-4">
                {t("forgotPassword.instruction")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("forgotPassword.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("forgotPassword.emailPlaceholder")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setCodeSent(false);
                  setSuccess("");
                }}
                required
                autoComplete="email"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="token">{t("forgotPassword.code")}</Label>
              <div className="flex gap-2">
                <Input
                  id="token"
                  type="text"
                  placeholder={t("forgotPassword.codePlaceholder")}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  maxLength={6}
                  className="flex-1 text-center text-xl tracking-widest rounded-xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendCode}
                  disabled={!email || codeLoading || countdown > 0}
                  className="whitespace-nowrap rounded-xl"
                >
                  {codeLoading ? t("forgotPassword.sending") : countdown > 0 ? `${countdown}s` : t("forgotPassword.sendCode")}
                </Button>
              </div>
            </div>

            {codeSent && (
              <div className="text-center">
                <p className="text-xs text-[#6B7B6E] mb-2">
                  {t("forgotPassword.noReceiveCode")}
                </p>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || codeLoading}
                  className="text-sm text-[#5B7D63] hover:underline disabled:text-[#B0B8B1] disabled:no-underline"
                >
                  {countdown > 0 ? `${countdown}${t("forgotPassword.countdownResend")}` : t("forgotPassword.resend")}
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full rounded-xl bg-[#7C9A82] hover:bg-[#5B7D63] text-white"
              disabled={loading || !codeSent || !token}
            >
              {t("forgotPassword.nextBtn")}
            </Button>
          </form>
        )}

        {step === "reset-password" && (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div className="text-center">
              <p className="text-sm text-[#6B7B6E] mb-4">
                {t("forgotPassword.instructionNewPassword")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("forgotPassword.newPassword")}</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder={t("forgotPassword.newPasswordPlaceholder")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("forgotPassword.confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t("forgotPassword.confirmPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="rounded-xl"
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
                {t("forgotPassword.backBtn")}
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-xl bg-[#7C9A82] hover:bg-[#5B7D63] text-white"
                disabled={loading || !newPassword || !confirmPassword}
              >
                {loading ? t("forgotPassword.submitting") : t("forgotPassword.submitBtn")}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <span className="text-[#6B7B6E]">{t("forgotPassword.hasAccount")}</span>{" "}
          <Link to="/login" className="text-[#5B7D63] hover:underline font-medium">
            {t("forgotPassword.loginNow")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
