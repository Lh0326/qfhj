import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import zh from "../locales/zh.json";
import en from "../locales/en.json";

const resources = {
  zh: { translation: zh },
  en: { translation: en },
};

// Read saved language preference, default to Chinese
const savedLang = localStorage.getItem("smarttcm-language");
const defaultLang = (savedLang === "en") ? "en" : "zh";

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: defaultLang,
    fallbackLng: "zh",
    supportedLngs: ["zh", "en"],
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
