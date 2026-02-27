import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DefaultThemes, type ThemeConfig, type ThemeMode, type ThemePalette } from "@inko/shared";
import { api } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";
import { applyThemePreferences, saveThemePreferences } from "../theme/theme.js";

type MeResponse = {
  id: string;
  email: string;
  displayName: string;
  themeMode: ThemeMode;
  themes: ThemeConfig;
  createdAt: number;
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

function normalizeHexColor(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const normalized = hex.length === 3 ? hex.split("").map((char) => `${char}${char}`).join("") : hex;
  return `#${normalized.toLowerCase()}`;
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
  const [themes, setThemes] = useState<ThemeConfig>(DefaultThemes);
  const [hexDrafts, setHexDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setThemeMode(user.themeMode);
    setThemes(user.themes);
    setActiveThemeEditor(user.themeMode);
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      api.updateMe(token ?? "", {
        displayName: displayName.trim(),
        themeMode,
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
