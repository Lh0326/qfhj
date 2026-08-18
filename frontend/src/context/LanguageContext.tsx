import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentUser, updateCurrentUser, User } from "../lib/auth";

type Language = "zh" | "en";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n, t } = useTranslation();

  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem("smarttcm-language");
    if (stored === "en") return "en";
    if (stored === "zh") return "zh";
    return "zh";
  });

  const [loading, setLoading] = useState(false);

  // 同步用户语言到后端
  const syncLanguageToBackend = useCallback(async (lang: Language) => {
    try {
      const user = await getCurrentUser();
      if (user.language !== lang) {
        await updateCurrentUser({ language: lang });
      }
    } catch (error) {
      console.warn("Failed to sync language to backend:", error);
    }
  }, []);

  // 从后端加载用户语言设置
  useEffect(() => {
    const loadUserLanguage = async () => {
      try {
        const user = await getCurrentUser();
        if (user.language && (user.language === "zh" || user.language === "en")) {
          const backendLang = user.language;
          setLanguageState(backendLang);
          localStorage.setItem("smarttcm-language", backendLang);
          i18n.changeLanguage(backendLang);
        }
      } catch (error) {
        console.warn("Failed to load user language from backend:", error);
      }
    };

    loadUserLanguage();
  }, [i18n]);

  const setLanguage = useCallback((lang: Language) => {
    setLoading(true);
    setLanguageState(lang);
    localStorage.setItem("smarttcm-language", lang);
    i18n.changeLanguage(lang);

    // 异步同步到后端
    syncLanguageToBackend(lang).finally(() => {
      setLoading(false);
    });
  }, [i18n, syncLanguageToBackend]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, loading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
