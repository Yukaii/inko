import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DefaultThemes, type ThemeConfig, type ThemeMode, type ThemePalette, type TypingMode } from "@inko/shared";
import { api } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";
import { applyThemePreferences, saveThemePreferences } from "../theme/theme.js";

type MeResponse = {
  id: string;
  email: string;
  displayName: string;
  themeMode: ThemeMode;
  typingMode: TypingMode;
  themes: ThemeConfig;
  createdAt: number;
};

type ThemePreset = {
  id: string;
  name: string;
  themes: ThemeConfig;
};

const PALETTE_FIELDS: Array<{ key: keyof ThemePalette; label: string }> = [
  { key: "accentOrange", label: "Accent Orange" },
  { key: "accentTeal", label: "Accent Teal" },
  { key: "bgPage", label: "Page Background" },
  { key: "bgCard", label: "Card Background" },
  { key: "bgElevated", label: "Elevated Background" },
  { key: "textPrimary", label: "Primary Text" },
  { key: "textSecondary", label: "Secondary Text" },
  { key: "textOnAccent", label: "Text On Accent" },
];
const CSS_VAR_TO_PALETTE_KEY: Record<string, keyof ThemePalette> = {
  "accent-orange": "accentOrange",
  "accent-teal": "accentTeal",
  "bg-page": "bgPage",
  "bg-card": "bgCard",
  "bg-elevated": "bgElevated",
  "text-primary": "textPrimary",
  "text-secondary": "textSecondary",
  "text-on-accent": "textOnAccent",
};

const THEME_PRESETS: ThemePreset[] = [
  {
    id: "inko-default",
    name: "Inkō Default",
    themes: DefaultThemes,
  },
  {
    id: "dracula",
    name: "Dracula (iTerm-inspired)",
    themes: {
      dark: {
        accentOrange: "#ffb86c",
        accentTeal: "#8be9fd",
        bgPage: "#282a36",
        bgCard: "#303341",
        bgElevated: "#383c4a",
        textPrimary: "#f8f8f2",
        textSecondary: "#b2b6c9",
        textOnAccent: "#1f2029",
      },
      light: { ...DefaultThemes.light },
    },
  },
  {
    id: "nord",
    name: "Nord (iTerm-inspired)",
    themes: {
      dark: {
        accentOrange: "#d08770",
        accentTeal: "#88c0d0",
        bgPage: "#2e3440",
        bgCard: "#3b4252",
        bgElevated: "#434c5e",
        textPrimary: "#eceff4",
        textSecondary: "#81a1c1",
        textOnAccent: "#2e3440",
      },
      light: {
        accentOrange: "#d08770",
        accentTeal: "#5e81ac",
        bgPage: "#eceff4",
        bgCard: "#e5e9f0",
        bgElevated: "#d8dee9",
        textPrimary: "#2e3440",
        textSecondary: "#4c566a",
        textOnAccent: "#2e3440",
      },
    },
  },
  {
    id: "gruvbox",
    name: "Gruvbox (iTerm-inspired)",
    themes: {
      dark: {
        accentOrange: "#fe8019",
        accentTeal: "#8ec07c",
        bgPage: "#282828",
        bgCard: "#32302f",
        bgElevated: "#3c3836",
        textPrimary: "#ebdbb2",
        textSecondary: "#a89984",
        textOnAccent: "#1d2021",
      },
      light: {
        accentOrange: "#d65d0e",
        accentTeal: "#689d6a",
        bgPage: "#fbf1c7",
        bgCard: "#f2e5bc",
        bgElevated: "#ebdbb2",
        textPrimary: "#3c3836",
        textSecondary: "#7c6f64",
        textOnAccent: "#fbf1c7",
      },
    },
  },
  {
    id: "tokyonight",
    name: "Tokyo Night (iTerm-inspired)",
    themes: {
      dark: {
        accentOrange: "#ff9e64",
        accentTeal: "#7dcfff",
        bgPage: "#1a1b26",
        bgCard: "#1f2335",
        bgElevated: "#24283b",
        textPrimary: "#c0caf5",
        textSecondary: "#9aa5ce",
        textOnAccent: "#1a1b26",
      },
      light: {
        accentOrange: "#b15c00",
        accentTeal: "#2e7de9",
        bgPage: "#d5d6db",
        bgCard: "#cbccd1",
        bgElevated: "#c0c0c6",
        textPrimary: "#3760bf",
        textSecondary: "#6172b0",
        textOnAccent: "#e1e2e7",
      },
    },
  },
  {
    id: "kanagawa",
    name: "Kanagawa (iTerm-inspired)",
    themes: {
      dark: {
        accentOrange: "#ffa066",
        accentTeal: "#7fb4ca",
        bgPage: "#1f1f28",
        bgCard: "#2a2a37",
        bgElevated: "#2d3348",
        textPrimary: "#dcd7ba",
        textSecondary: "#a6a69c",
        textOnAccent: "#1f1f28",
      },
      light: {
        accentOrange: "#c4742f",
        accentTeal: "#4c88a8",
        bgPage: "#f2ecdc",
        bgCard: "#e9e1d0",
        bgElevated: "#dfd4c0",
        textPrimary: "#2a2a37",
        textSecondary: "#5a5a67",
        textOnAccent: "#f2ecdc",
      },
    },
  },
  {
    id: "ayu",
    name: "Ayu (iTerm-inspired)",
    themes: {
      dark: {
        accentOrange: "#ffb454",
        accentTeal: "#95e6cb",
        bgPage: "#0f1419",
        bgCard: "#131b24",
        bgElevated: "#1a2430",
        textPrimary: "#e6e1cf",
        textSecondary: "#b3b1ad",
        textOnAccent: "#0f1419",
      },
      light: {
        accentOrange: "#f29718",
        accentTeal: "#4cbf99",
        bgPage: "#fafafa",
        bgCard: "#f0f0f0",
        bgElevated: "#e8e8e8",
        textPrimary: "#5c6773",
        textSecondary: "#787b80",
        textOnAccent: "#fafafa",
      },
    },
  },
];

function normalizeHexColor(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const normalized = hex.length === 3 ? hex.split("").map((char) => `${char}${char}`).join("") : hex;
  return `#${normalized.toLowerCase()}`;
}

function parsePaletteFromUnknown(input: unknown): ThemePalette | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const next: Partial<ThemePalette> = {};

  for (const { key } of PALETTE_FIELDS) {
    const cssKey = Object.entries(CSS_VAR_TO_PALETTE_KEY).find(([, value]) => value === key)?.[0];
    const raw = record[key] ?? (cssKey ? record[cssKey] : undefined) ?? (cssKey ? record[`--${cssKey}`] : undefined);
    if (typeof raw !== "string") return null;
    const parsed = normalizeHexColor(raw);
    if (!parsed) return null;
    next[key] = parsed;
  }

  return next as ThemePalette;
}

function parseThemePayload(text: string, currentMode: ThemeMode, currentThemes: ThemeConfig): ThemeConfig | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const root = (parsed.themes && typeof parsed.themes === "object" ? parsed.themes : parsed) as Record<string, unknown>;
    const dark = parsePaletteFromUnknown(root.dark);
    const light = parsePaletteFromUnknown(root.light);
    if (dark && light) return { dark, light };
    const single = parsePaletteFromUnknown(root);
    if (single) return { ...currentThemes, [currentMode]: single };
  } catch {
    // Fall through to text formats.
  }

  const cssBlockRegex = /\[data-theme="(dark|light)"\]\s*\{([\s\S]*?)\}/g;
  let cssMatch: RegExpExecArray | null;
  let foundCssBlock = false;
  let nextThemes = { ...currentThemes };
  while ((cssMatch = cssBlockRegex.exec(trimmed)) !== null) {
    foundCssBlock = true;
    const mode = cssMatch[1] as ThemeMode;
    const body = cssMatch[2] ?? "";
    const varRecord: Record<string, string> = {};
    const varRegex = /--([a-z-]+)\s*:\s*([^;]+);/g;
    let varMatch: RegExpExecArray | null;
    while ((varMatch = varRegex.exec(body)) !== null) {
      const varName = varMatch[1];
      const value = varMatch[2];
      const key = CSS_VAR_TO_PALETTE_KEY[varName];
      if (!key) continue;
      varRecord[key] = value;
    }
    const parsedPalette = parsePaletteFromUnknown(varRecord);
    if (parsedPalette) {
      nextThemes = { ...nextThemes, [mode]: parsedPalette };
    }
  }
  if (foundCssBlock) return nextThemes;

  const pairRecord: Record<string, string> = {};
  for (const line of trimmed.split(/\r?\n/)) {
    const row = line.trim();
    if (!row || (!row.includes("=") && !row.includes(":"))) continue;
    const delimiter = row.includes("=") ? "=" : ":";
    const [left, ...rightParts] = row.split(delimiter);
    if (!left || rightParts.length === 0) continue;
    const right = rightParts.join(delimiter).trim();
    const normalizedLeft = left.trim().replace(/^--/, "");
    const paletteKey = (CSS_VAR_TO_PALETTE_KEY[normalizedLeft] ?? normalizedLeft) as keyof ThemePalette;
    pairRecord[paletteKey] = right;
  }
  const parsedPairsPalette = parsePaletteFromUnknown(pairRecord);
  if (parsedPairsPalette) {
    return { ...currentThemes, [currentMode]: parsedPairsPalette };
  }

  return null;
}

export function ProfilePage() {
  const { token, setToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [activeThemeEditor, setActiveThemeEditor] = useState<ThemeMode>("dark");

  const profileQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(token ?? ""),
    enabled: Boolean(token),
  });

  const user = profileQuery.data as MeResponse | undefined;

  const [displayName, setDisplayName] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [typingMode, setTypingMode] = useState<TypingMode>("language_specific");
  const [themes, setThemes] = useState<ThemeConfig>(DefaultThemes);
  const [hexDrafts, setHexDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setThemeMode(user.themeMode);
    setTypingMode(user.typingMode);
    setThemes(user.themes);
    setActiveThemeEditor(user.themeMode);
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      api.updateMe(token ?? "", {
        displayName: displayName.trim(),
        themeMode,
        typingMode,
        themes,
      }),
    onSuccess: (updated) => {
      const nextUser = updated as MeResponse;
      queryClient.setQueryData(["me"], nextUser);
      applyThemePreferences({ themeMode: nextUser.themeMode, themes: nextUser.themes });
      saveThemePreferences({ themeMode: nextUser.themeMode, themes: nextUser.themes });
      setMessage("Profile updated.");
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "Failed to update profile.");
    },
  });

  const canSave = useMemo(
    () => displayName.trim().length > 0 && displayName.trim().length <= 60 && !updateProfileMutation.isPending,
    [displayName, updateProfileMutation.isPending],
  );

  const updatePaletteColor = (mode: ThemeMode, key: keyof ThemePalette, value: string) => {
    setThemes((prev) => {
      const next = {
        ...prev,
        [mode]: {
          ...prev[mode],
          [key]: value,
        },
      };
      applyThemePreferences({ themeMode, themes: next });
      return next;
    });
  };

  const draftKey = (mode: ThemeMode, key: keyof ThemePalette) => `${mode}:${key}`;

  const commitHexValue = (mode: ThemeMode, key: keyof ThemePalette, raw: string) => {
    const normalized = normalizeHexColor(raw);
    if (!normalized) {
      setMessage(`Invalid hex color: "${raw}"`);
      return;
    }
    setMessage("");
    setHexDrafts((prev) => ({ ...prev, [draftKey(mode, key)]: normalized }));
    updatePaletteColor(mode, key, normalized);
  };

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyThemePreferences({ themeMode: mode, themes });
  };

  const resetActiveTheme = () => {
    setThemes((prev) => {
      const next = {
        ...prev,
        [activeThemeEditor]: { ...DefaultThemes[activeThemeEditor] },
      };
      applyThemePreferences({ themeMode, themes: next });
      return next;
    });
  };

  const applyPreset = (preset: ThemePreset) => {
    const nextThemes = preset.themes;
    setThemes(nextThemes);
    applyThemePreferences({ themeMode, themes: nextThemes });
    setMessage(`Applied preset: ${preset.name}`);
  };

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
    } catch {
      setMessage("Clipboard permission denied. Copy manually from export file.");
    }
  };

  const exportThemeJson = () => {
    const payload = JSON.stringify({ themeMode, themes }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "inko-theme.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Theme exported as JSON.");
  };

  const buildCurrentPaletteText = () => {
    const current = themes[activeThemeEditor];
    return PALETTE_FIELDS.map((field) => `${field.key}=${current[field.key]}`).join("\n");
  };

  const buildCssVarsText = () => {
    const toBlock = (mode: ThemeMode) => {
      const palette = themes[mode];
      return [
        `[data-theme="${mode}"] {`,
        `  --accent-orange: ${palette.accentOrange};`,
        `  --accent-teal: ${palette.accentTeal};`,
        `  --bg-page: ${palette.bgPage};`,
        `  --bg-card: ${palette.bgCard};`,
        `  --bg-elevated: ${palette.bgElevated};`,
        `  --text-primary: ${palette.textPrimary};`,
        `  --text-secondary: ${palette.textSecondary};`,
        `  --text-on-accent: ${palette.textOnAccent};`,
        "}",
      ].join("\n");
    };
    return `${toBlock("dark")}\n\n${toBlock("light")}`;
  };

  const applyImportedTheme = (input: string, source: string) => {
    const parsed = parseThemePayload(input, activeThemeEditor, themes);
    if (!parsed) {
      return false;
    }
    setThemes(parsed);
    applyThemePreferences({ themeMode, themes: parsed });
    setMessage(`Imported theme from ${source}.`);
    return true;
  };

  const handleSignOut = () => {
    setToken(null);
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="mb-2">
        <h1 className="m-0 text-4xl font-semibold [font-family:var(--font-display)]">Profile</h1>
        <p className="mt-1 text-sm text-text-secondary">Customize your name and app theme.</p>
      </header>

      <section className="rounded-base bg-bg-card p-7">
        {profileQuery.isLoading ? (
          <p className="m-0 text-sm text-text-secondary">Loading profile...</p>
        ) : profileQuery.isError ? (
          <p className="m-0 text-sm text-[var(--danger-text)]">Failed to load profile.</p>
        ) : user ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="display-name" className="text-xs font-medium uppercase tracking-[0.04em] text-text-secondary">
                Display Name
              </label>
              <input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
                placeholder="Your name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.04em] text-text-secondary">Email</span>
              <div className="rounded-[10px] border border-[var(--border-strong)] bg-bg-elevated px-3 py-2.5 font-mono text-sm text-text-secondary">
                {user.email}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.04em] text-text-secondary">Theme Mode</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={themeMode === "dark" ? "" : "bg-bg-elevated text-text-primary hover:bg-bg-elevated"}
                  onClick={() => handleThemeModeChange("dark")}
                >
                  Dark
                </button>
                <button
                  type="button"
                  className={themeMode === "light" ? "" : "bg-bg-elevated text-text-primary hover:bg-bg-elevated"}
                  onClick={() => handleThemeModeChange("light")}
                >
                  Light
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.04em] text-text-secondary">Typing Mode</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={typingMode === "language_specific" ? "" : "bg-bg-elevated text-text-primary hover:bg-bg-elevated"}
                  onClick={() => setTypingMode("language_specific")}
                >
                  Language Specific
                </button>
                <button
                  type="button"
                  className={typingMode === "universal" ? "" : "bg-bg-elevated text-text-primary hover:bg-bg-elevated"}
                  onClick={() => setTypingMode("universal")}
                >
                  Universal
                </button>
              </div>
              <p className="m-0 text-[12px] text-text-secondary">
                Language-specific uses script-aware matching (e.g. romaji to kana for Japanese). Universal uses normalized direct typing.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.04em] text-text-secondary">Joined</span>
              <div className="rounded-[10px] border border-[var(--border-strong)] bg-bg-elevated px-3 py-2.5 font-mono text-sm text-text-secondary">
                {new Date(user.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ) : (
          <p className="m-0 text-sm text-text-secondary">Profile is unavailable.</p>
        )}
      </section>

      <section className="rounded-base bg-bg-card p-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="m-0 text-[22px] font-semibold [font-family:var(--font-display)]">Theme Editor</h2>
          <button type="button" className="bg-bg-elevated text-text-primary hover:bg-bg-elevated" onClick={resetActiveTheme}>
            Reset {activeThemeEditor}
          </button>
        </div>

        <div className="mb-5 flex gap-2">
          <button
            type="button"
            className={activeThemeEditor === "dark" ? "" : "bg-bg-elevated text-text-primary hover:bg-bg-elevated"}
            onClick={() => setActiveThemeEditor("dark")}
          >
            Dark Palette
          </button>
          <button
            type="button"
            className={activeThemeEditor === "light" ? "" : "bg-bg-elevated text-text-primary hover:bg-bg-elevated"}
            onClick={() => setActiveThemeEditor("light")}
          >
            Light Palette
          </button>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-xs uppercase tracking-[0.04em] text-text-secondary">Theme Presets</p>
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="bg-bg-elevated text-text-primary hover:bg-bg-elevated"
                onClick={() => applyPreset(preset)}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-text-secondary">
            Presets are inspired by iTerm2 color schemes.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PALETTE_FIELDS.map((field) => (
            <div
              key={field.key}
              className="flex items-center gap-3 rounded-[10px] border border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-elevated px-3 py-2.5"
            >
              <input
                type="color"
                value={themes[activeThemeEditor][field.key]}
                onChange={(event) => {
                  const color = event.target.value;
                  setHexDrafts((prev) => ({ ...prev, [draftKey(activeThemeEditor, field.key)]: color }));
                  updatePaletteColor(activeThemeEditor, field.key, color);
                }}
                className="h-9 w-9 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
              />
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-sm text-text-secondary">{field.label}</span>
                <input
                  type="text"
                  value={hexDrafts[draftKey(activeThemeEditor, field.key)] ?? themes[activeThemeEditor][field.key]}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setHexDrafts((prev) => ({ ...prev, [draftKey(activeThemeEditor, field.key)]: raw }));
                  }}
                  onBlur={(event) => commitHexValue(activeThemeEditor, field.key, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitHexValue(activeThemeEditor, field.key, (event.target as HTMLInputElement).value);
                    }
                  }}
                  onPaste={(event) => {
                    const pasted = event.clipboardData.getData("text");
                    if (!pasted) return;
                    event.preventDefault();
                    const importedWholeTheme = applyImportedTheme(pasted, "pasted text");
                    if (importedWholeTheme) return;
                    setHexDrafts((prev) => ({ ...prev, [draftKey(activeThemeEditor, field.key)]: pasted }));
                    commitHexValue(activeThemeEditor, field.key, pasted);
                  }}
                  placeholder="#rrggbb"
                  className="min-w-0 font-mono text-xs"
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-base bg-bg-card p-7">
        <h2 className="m-0 mb-3 text-[22px] font-semibold [font-family:var(--font-display)]">Share Theme</h2>
        <p className="m-0 mb-4 text-sm text-text-secondary">
          Copy or export your theme values for reuse.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="bg-bg-elevated text-text-primary hover:bg-bg-elevated"
            onClick={() => copyToClipboard(JSON.stringify({ themeMode, themes }, null, 2), "Theme JSON copied.")}
          >
            Copy JSON
          </button>
          <button
            type="button"
            className="bg-bg-elevated text-text-primary hover:bg-bg-elevated"
            onClick={() => copyToClipboard(buildCssVarsText(), "CSS variables copied.")}
          >
            Copy CSS Vars
          </button>
          <button
            type="button"
            className="bg-bg-elevated text-text-primary hover:bg-bg-elevated"
            onClick={() => copyToClipboard(buildCurrentPaletteText(), `${activeThemeEditor} palette hex values copied.`)}
          >
            Copy {activeThemeEditor} Hex
          </button>
          <button type="button" className="bg-bg-elevated text-text-primary hover:bg-bg-elevated" onClick={exportThemeJson}>
            Export JSON
          </button>
        </div>
      </section>

      <section className="rounded-base bg-bg-card p-7">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => updateProfileMutation.mutate()} disabled={!canSave}>
            Save Profile & Theme
          </button>
          <button type="button" className="bg-[var(--danger-bg)] text-[var(--danger-text)] hover:bg-[var(--danger-bg-hover)]" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
        {message ? <p className="m-0 text-sm text-accent-teal">{message}</p> : null}
      </section>
    </div>
  );
}
