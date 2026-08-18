import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { AlertCircle } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loggedInUser = await login(username, password);
      if (loggedInUser?.isSuperuser) {
        navigate("/dashboard");
      } else {
        navigate("/");
      }
    } catch (err) {
      const error = err as Error & { message?: string };
      setError(error.message || t("login.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#F5F0E8]/50 to-white p-4">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#E8F0EA]/30 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#F5F0E8]/40 blur-3xl" />

      <Card className="relative z-10 w-full max-w-md p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border-0 bg-white/80 backdrop-blur rounded-[2rem]">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🌿</div>
          <h1 className="text-3xl font-bold tracking-[4px] text-[#2D3B2E] mb-2">
            千方慧鉴
          </h1>
          <p className="text-[#6B7B6E]">{t("login.title")}</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username">{t("login.username")}</Label>
            <Input
              id="username"
              type="text"
              placeholder={t("login.usernamePlaceholder")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("login.password")}</Label>
              <Link to="/forgot-password" className="text-sm text-[#5B7D63] hover:underline">
                {t("login.forgotPassword")}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="rounded-xl"
            />
          </div>

          <Button
            type="submit"
            className="w-full rounded-xl bg-[#7C9A82] text-white hover:bg-[#5B7D63]"
            disabled={loading}
          >
            {loading ? t("login.submitting") : t("login.submitBtn")}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-[#6B7B6E]">{t("login.noAccount")}</span>{" "}
          <Link to="/register" className="font-medium text-[#5B7D63] hover:underline">
            {t("login.registerNow")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
