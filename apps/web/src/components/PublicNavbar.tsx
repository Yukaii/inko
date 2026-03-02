import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ThemeMode } from "@inko/shared";
import { SUPPORTED_UI_LANGUAGES } from "../i18n";
import { applyThemePreferences, loadThemePreferences, saveThemePreferences } from "../theme/theme";

type PublicNavbarProps = {
  showAnchors?: boolean;
};

export function PublicNavbar({ showAnchors = false }: PublicNavbarProps) {
  const { t, i18n } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [themeMode, setThemeMode] = useState(() => loadThemePreferences().themeMode);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const currentLang = useMemo(
    () => SUPPORTED_UI_LANGUAGES.find((lang) => i18n.language.startsWith(lang.code)) || SUPPORTED_UI_LANGUAGES[0],
    [i18n.language],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = () => {
    const current = loadThemePreferences();
    const nextThemeMode: ThemeMode = current.themeMode === "dark" ? "light" : "dark";
    const next = { ...current, themeMode: nextThemeMode };
    applyThemePreferences(next);
    saveThemePreferences(next);
    setThemeMode(nextThemeMode);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--bg-card)_88%,transparent)] px-6 py-4 backdrop-blur-md md:px-12">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
        <div className="flex items-center gap-10">
          <Link
            to="/"
            className="font-display text-xl font-semibold text-accent-orange no-underline transition-opacity hover:opacity-80"
          >
            inko
          </Link>
          <div className="hidden items-center gap-6 font-mono text-sm text-text-secondary md:flex">
            {showAnchors ? (
              <>
                <a href="#how-it-works" className="text-text-secondary transition-colors hover:text-text-primary no-underline">
                  {t("landing.nav.how_it_works")}
                </a>
                <a href="#features" className="text-text-secondary transition-colors hover:text-text-primary no-underline">
                  {t("landing.nav.features")}
                </a>
              </>
            ) : null}
            <Link to="/community" className="text-text-secondary transition-colors hover:text-text-primary no-underline">
              {t("landing.nav.community")}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            title={themeMode === "dark" ? t("common.switch_to_light") : t("common.switch_to_dark")}
            aria-label={themeMode === "dark" ? t("common.switch_to_light") : t("common.switch_to_dark")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-bg-elevated text-text-secondary transition hover:border-accent-orange hover:text-accent-orange"
          >
            {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="relative" ref={langMenuRef}>
            <button
              type="button"
              onClick={() => setShowLangMenu((current) => !current)}
              title={t("common.change_language")}
              className="flex items-center gap-2 rounded-full border border-accent-orange/20 bg-accent-orange px-4 py-2 font-mono text-xs font-bold text-text-on-accent transition-transform hover:scale-105 active:scale-95"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="min-w-[20px] text-left uppercase">{currentLang.short}</span>
              <span className={`text-[8px] transition-transform duration-200 ${showLangMenu ? "rotate-180" : ""}`}>▼</span>
            </button>

            <AnimatePresence>
              {showLangMenu ? (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 mt-2 flex w-40 flex-col gap-1 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-bg-card p-1.5 shadow-2xl ring-1 ring-black/10"
                >
                  {SUPPORTED_UI_LANGUAGES.map((lang) => {
                    const isActive = i18n.language.startsWith(lang.code);
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          void i18n.changeLanguage(lang.code);
                          setShowLangMenu(false);
                        }}
                        className={`flex w-full items-center rounded-lg px-3 py-2 text-left font-mono text-[11px] font-bold transition-all ${
                          isActive
                            ? "bg-accent-teal text-text-on-accent"
                            : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                        }`}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <Link
            to="/dashboard"
            className="rounded-xl bg-accent-orange px-5 py-2 font-mono text-xs font-bold text-text-on-accent no-underline transition-transform hover:scale-105 active:scale-95"
          >
            {t("landing.nav.get_started")}
          </Link>
        </div>
      </div>
    </nav>
  );
}
