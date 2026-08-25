import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { enUS, fr } from "date-fns/locale";
import en from "./locales/en.json";
import frMessages from "./locales/fr.json";

export type Language = "en" | "fr";
type TranslationParams = Record<string, string | number>;
type Messages = typeof en;

interface I18nContextValue {
  language: Language;
  localeCode: string;
  dateLocale: typeof enUS;
  setLanguage: (language: Language) => void;
  translate: (key: string, params?: TranslationParams) => string;
}

const LANGUAGE_STORAGE_KEY = "archicopro-language";
const messages: Record<Language, Messages> = {
  en,
  fr: frMessages,
};

const I18nContext = createContext<I18nContextValue | null>(null);

const getMessageValue = (dictionary: Messages, key: string): string | undefined => {
  const value = key.split(".").reduce<unknown>((currentValue, part) => {
    if (
      currentValue &&
      typeof currentValue === "object" &&
      part in (currentValue as Record<string, unknown>)
    ) {
      return (currentValue as Record<string, unknown>)[part];
    }

    return undefined;
  }, dictionary);

  return typeof value === "string" ? value : undefined;
};

const interpolate = (template: string, params?: TranslationParams) => {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
};

const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") {
    return "en";
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (storedLanguage === "en" || storedLanguage === "fr") {
    return storedLanguage;
  }

  return window.navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
  }, []);

  const translate = useCallback(
    (key: string, params?: TranslationParams) => {
      const template =
        getMessageValue(messages[language], key) ??
        getMessageValue(messages.en, key) ??
        key;

      return interpolate(template, params);
    },
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      localeCode: language === "fr" ? "fr-FR" : "en-US",
      dateLocale: language === "fr" ? fr : enUS,
      setLanguage,
      translate,
    }),
    [language, setLanguage, translate],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }

  return context;
}
