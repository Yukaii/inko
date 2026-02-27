import { DefaultThemes, type ThemeConfig, type ThemeMode, type ThemePalette } from "@inko/shared";

type ProfileThemePreferences = {
  themeMode: ThemeMode;
  themes: ThemeConfig;
};

const STORAGE_KEY = "inko_theme_preferences";

const CSS_VAR_MAP: Record<keyof ThemePalette, string> = {
  accentOrange: "--accent-orange",
  accentTeal: "--accent-teal",
  bgPage: "--bg-page",
  bgCard: "--bg-card",
  bgElevated: "--bg-elevated",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  textOnAccent: "--text-on-accent",
};

export function applyThemePreferences(input: ProfileThemePreferences) {
  const root = document.documentElement;
  const palette = input.themes[input.themeMode];

  root.dataset.theme = input.themeMode;
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP) as Array<[keyof ThemePalette, string]>) {
    root.style.setProperty(cssVar, palette[key]);
  }
}

export function saveThemePreferences(input: ProfileThemePreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
}

export function loadThemePreferences(): ProfileThemePreferences {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { themeMode: "dark", themes: DefaultThemes };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProfileThemePreferences>;
    const themeMode = parsed.themeMode === "light" ? "light" : "dark";
    const dark = { ...DefaultThemes.dark, ...(parsed.themes?.dark ?? {}) };
    const light = { ...DefaultThemes.light, ...(parsed.themes?.light ?? {}) };
    return { themeMode, themes: { dark, light } };
  } catch {
    return { themeMode: "dark", themes: DefaultThemes };
  }
}

