import React from "react";
import { useI18n } from "../i18n";

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
}

export default function LanguageSwitcher({
  compact = false,
  className = "",
}: LanguageSwitcherProps) {
  const { language, setLanguage, translate } = useI18n();

  return (
    <div
      className={`inline-flex items-center rounded-[10px] border border-slate-200 bg-white p-1 shadow-sm ${className}`.trim()}
      aria-label={translate("languageSwitcher.ariaLabel")}
    >
      {(["en", "fr"] as const).map((option) => {
        const isActive = language === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => setLanguage(option)}
            className={`rounded-lg px-3 py-1.5 font-bold transition-all cursor-pointer ${
              compact ? "text-[10px] uppercase tracking-[0.2em]" : "text-xs"
            } ${
              isActive
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {option.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
