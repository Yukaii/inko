import { NavLink, matchPath, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ThemeConfig, ThemeMode } from "@inko/shared";
import { registerShortcut, getShortcutsList } from "../hooks/useKeyboard";
import { useAuth } from "../hooks/useAuth";
import { api } from "../api/client";
import { applyThemePreferences, saveThemePreferences } from "../theme/theme";
import { SUPPORTED_UI_LANGUAGES } from "../i18n";

// Simple icon components
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function DecksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21a8 8 0 1 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 4H9l-3-4H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function CommunityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const NAV_LINKS = [
  { to: "/dashboard", label: "nav.dashboard", mobileLabel: "nav.home", Icon: HomeIcon, key: "d" },
  { to: "/word-bank", label: "nav.word_bank", mobileLabel: "nav.decks", Icon: DecksIcon, key: "w" },
  { to: "/community", label: "nav.community", mobileLabel: "nav.community", Icon: CommunityIcon, key: "c" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, signOut } = useAuth();
  const [showHelp, setShowHelp] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLangSubMenu, setShowLangSubMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  
  const currentLangLabel = SUPPORTED_UI_LANGUAGES.find((l) => i18n.language.startsWith(l.code))?.label || t("common.language_english");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(token ?? ""),
    enabled: Boolean(token),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const user = meQuery.data as { displayName: string; email: string; themeMode: ThemeMode; themes: ThemeConfig; canModerateCommunity?: boolean } | undefined;

  useEffect(() => {
    const me = meQuery.data as { themeMode: ThemeMode; themes: ThemeConfig } | undefined;
    if (!me) return;
    const preferences = { themeMode: me.themeMode, themes: me.themes };
    applyThemePreferences(preferences);
    saveThemePreferences(preferences);
  }, [meQuery.data]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
        setShowLangSubMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileMenu]);

  // Register global navigation shortcuts
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    // Navigation shortcuts (g + key)
    cleanups.push(
      registerShortcut({
        key: "g",
        handler: () => {
          const handler = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            const link = NAV_LINKS.find((l) => l.key === key);
            if (link) {
              e.preventDefault();
              navigate(link.to);
            } else if (key === "s") {
              e.preventDefault();
              navigate("/settings");
            }
            window.removeEventListener("keydown", handler, { capture: true });
          };
          window.addEventListener("keydown", handler, { capture: true, once: true });
        },
        description: t("shortcuts.go_to_page_sequence"),
      }),
    );

    // Direct number shortcuts for nav links
    for (const [index, link] of NAV_LINKS.entries()) {
      cleanups.push(
        registerShortcut({
          key: String(index + 1),
          handler: () => navigate(link.to),
          description: `Go to ${t(link.label)}`,
        })
      );
    }

    // Settings shortcut
    cleanups.push(
      registerShortcut({
        key: "s",
        handler: () => navigate("/settings"),
        description: t("shortcuts.go_settings_direct"),
      })
    );

    // Help shortcut
    cleanups.push(
      registerShortcut({
        key: "?",
        shift: true,
        handler: () => setShowHelp((prev) => !prev),
        description: t("shortcuts.toggle_help"),
      })
    );

    // Escape to close help
    cleanups.push(
      registerShortcut({
        key: "Escape",
        handler: () => {
          setShowHelp(false);
          setShowProfileMenu(false);
        },
        description: t("shortcuts.close_dialogs"),
      })
    );

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [navigate, t]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const shortcuts = getShortcutsList();
  const isPracticeRoute = matchPath("/practice/:deckId", location.pathname) !== null;
  const showMobileNav = !isPracticeRoute;

  return (
    <div className="grid h-screen overflow-hidden md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-1 grid-cols-1 grid-rows-[1fr_auto]">
      {/* Desktop Sidebar */}
      <aside className="hidden h-screen flex-col gap-3 overflow-y-auto border-r border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-page p-6 md:flex">
        <div className="mb-4 text-[22px] text-accent-orange [font-family:var(--font-display)]" role="banner">
          <span lang="ja">inkō</span>
        </div>
        <nav className="flex flex-col gap-1" aria-label={t("common.main_navigation")}>
          {NAV_LINKS.map((link, index) => (
            <NavLink
              key={link.to}
              className={({ isActive }) =>
                `flex items-center justify-between whitespace-nowrap rounded-xl px-3.5 py-2.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus:bg-bg-elevated focus:text-text-primary ${isActive ? "bg-bg-elevated text-text-primary" : ""}`
              }
              to={link.to}
              tabIndex={0}
              aria-current={location.pathname === link.to ? "page" : undefined}
            >
              <span>{t(link.label)}</span>
              <kbd
                className="shrink-0 rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-card px-1.5 py-0.5 font-mono text-[11px] text-text-secondary opacity-60 transition-all"
                aria-label={`Shortcut: press ${index + 1}`}
              >
                {index + 1}
              </kbd>
            </NavLink>
          ))}
        </nav>
        
        <div className="mt-auto flex flex-col gap-2 border-t border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] pt-4">
          {/* Settings Link */}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center justify-between whitespace-nowrap rounded-xl px-3.5 py-2.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus:bg-bg-elevated focus:text-text-primary ${isActive ? "bg-bg-elevated text-text-primary" : ""}`
            }
            aria-current={location.pathname === "/settings" ? "page" : undefined}
          >
            <span className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              {t("nav.settings")}
            </span>
            <kbd className="shrink-0 rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-card px-1.5 py-0.5 font-mono text-[11px] text-text-secondary opacity-60">
              s
            </kbd>
          </NavLink>
          
          {/* Profile Dropdown Button */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl bg-transparent px-3.5 py-2.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus:bg-bg-elevated focus:text-text-primary"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-expanded={showProfileMenu}
              aria-haspopup="menu"
            >
              <span className="flex items-center gap-2 truncate">
                <UserIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{user?.displayName || t("auth.profile")}</span>
              </span>
              <span className="text-xs text-text-secondary">⌄</span>
            </button>
            
            {showProfileMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-card p-1 shadow-lg">
                <div className="border-b border-[var(--border-subtle)] px-3 py-2">
                  <p className="m-0 truncate text-sm font-medium text-text-primary">{user?.displayName}</p>
                  <p className="m-0 truncate text-xs text-text-secondary">{user?.email}</p>
                </div>
                
                {/* Language Selection in Dropdown */}
                <div className="flex flex-col pt-1">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg bg-transparent px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLangSubMenu(!showLangSubMenu);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <GlobeIcon className="h-4 w-4" />
                      <span>{currentLangLabel}</span>
                    </div>
                    <span className={`text-[10px] transition-transform ${showLangSubMenu ? "rotate-180" : ""}`}>▼</span>
                  </button>
                  
                  {showLangSubMenu && (
                    <div className="flex flex-col gap-0.5 py-1 pl-6">
                      {SUPPORTED_UI_LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void i18n.changeLanguage(lang.code);
                            setShowLangSubMenu(false);
                          }}
                          className={`flex w-full items-center rounded-md bg-transparent px-3 py-1.5 text-left text-xs transition-colors hover:bg-bg-elevated ${i18n.language.startsWith(lang.code) ? "text-accent-teal" : "text-text-secondary"}`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <NavLink
                  to="/settings"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <SettingsIcon className="h-4 w-4" />
                  {t("auth.settings")}
                </NavLink>
                <NavLink
                  to="/community/submissions"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <InboxIcon className="h-4 w-4 shrink-0" />
                  {t("nav.my_submissions")}
                </NavLink>
                {user?.canModerateCommunity ? (
                  <NavLink
                    to="/community/moderation"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <ShieldIcon className="h-[18px] w-[18px] shrink-0" />
                    {t("nav.community_moderation")}
                  </NavLink>
                ) : null}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg bg-transparent px-3 py-2 text-sm text-[var(--danger-text)] transition-colors hover:bg-[var(--danger-bg)]"
                  onClick={() => void handleSignOut()}
                >
                  <LogoutIcon className="h-4 w-4" />
                  {t("auth.sign_out")}
                </button>
              </div>
            )}
          </div>
          
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-[10px] border border-dashed border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-transparent px-3.5 py-2.5 text-[13px] font-normal text-text-secondary transition-all hover:border-accent-orange hover:bg-bg-elevated hover:text-text-primary focus:border-accent-orange focus:bg-bg-elevated focus:text-text-primary"
            onClick={() => setShowHelp(true)}
            aria-label={`${t("nav.shortcuts")} (Shift+?)`}
          >
            <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-card px-1.5 py-0.5 font-mono text-[11px]">?</kbd>
            <span>{t("nav.shortcuts")}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className={`fixed inset-x-0 bottom-0 z-[9999] h-16 items-center justify-around border-t border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-page px-2 shadow-[0_-2px_10px_color-mix(in_oklab,var(--text-primary)_18%,transparent)] md:hidden ${showMobileNav ? "flex" : "hidden"}`} aria-label={t("common.mobile_navigation")}>
        {NAV_LINKS.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <NavLink
              key={link.to}
              className={`flex max-w-20 flex-1 flex-col items-center justify-center gap-1 bg-transparent px-4 py-2 transition-colors ${isActive ? "text-accent-orange" : "text-text-secondary hover:text-text-primary focus:text-text-primary"}`}
              to={link.to}
              aria-current={isActive ? "page" : undefined}
            >
              <link.Icon className="h-[22px] w-[22px]" />
              <span className="text-[11px] font-medium">{t(link.mobileLabel)}</span>
            </NavLink>
          );
        })}
        
        {/* Mobile Settings Link */}
        <NavLink
          to="/settings"
          className={`flex max-w-20 flex-1 flex-col items-center justify-center gap-1 bg-transparent px-4 py-2 transition-colors ${location.pathname === "/settings" ? "text-accent-orange" : "text-text-secondary hover:text-text-primary focus:text-text-primary"}`}
          aria-current={location.pathname === "/settings" ? "page" : undefined}
        >
          <SettingsIcon className="h-[22px] w-[22px]" />
          <span className="text-[11px] font-medium">{t("nav.settings")}</span>
        </NavLink>
      </nav>

      <main id="main-content" className={`h-screen overflow-y-auto px-5 pt-5 ${showMobileNav ? "pb-[84px]" : "pb-5"} md:px-10 md:py-8`} tabIndex={-1}>
        {children}
      </main>

      {showHelp && (
        <KeyboardHelpModal shortcuts={shortcuts} onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
}

function KeyboardHelpModal({
  shortcuts,
  onClose,
}: {
  shortcuts: Array<{ key: string; description: string }>;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    modal.addEventListener("keydown", handleTab);
    window.addEventListener("keydown", handleEscape);
    firstElement?.focus();

    return () => {
      modal.removeEventListener("keydown", handleTab);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <button
      type="button"
      className="fixed inset-0 z-[1000] flex w-full cursor-default items-center justify-center border-0 bg-[var(--overlay-bg-strong)] p-5"
      onClick={onClose}
      onKeyDown={handleOverlayKeyDown}
      aria-label={t("nav.close_shortcuts_help")}
    >
      <section
        ref={modalRef}
        className="max-h-[80vh] w-full max-w-[500px] overflow-y-auto rounded-base border border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
        aria-modal="true"
        aria-label={t("nav.shortcuts_help")}
      >
        <header className="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] px-6 py-5">
          <h2 className="[font-family:var(--font-display)] text-2xl text-text-primary">{t("nav.shortcuts_help")}</h2>
          <button type="button" className="border-0 bg-transparent p-1 text-2xl leading-none text-text-secondary transition-colors hover:text-text-primary focus:text-text-primary" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </header>
        <div className="flex flex-col gap-6 p-6">
          <section>
            <h3 className="mb-3 [font-family:var(--font-display)] text-sm uppercase tracking-[0.06em] text-text-secondary">{t("common.navigation")}</h3>
            <dl className="flex flex-col gap-2">
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-[100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">1</kbd>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">2</kbd>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">3</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">{t("shortcuts.nav_numbers", "Go to Dashboard / Word Bank / Settings")}</dd>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-[100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">g</kbd>
                  <span className="text-xs text-text-secondary">{t("common.then")}</span>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">d</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">{t("shortcuts.go_dashboard", "Go to Dashboard")}</dd>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-[100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">g</kbd>
                  <span className="text-xs text-text-secondary">{t("common.then")}</span>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">w</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">{t("shortcuts.go_word_bank", "Go to Word Bank")}</dd>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-[100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">g</kbd>
                  <span className="text-xs text-text-secondary">{t("common.then")}</span>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">s</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">{t("shortcuts.go_settings", "Go to Settings")}</dd>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-[100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">s</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">{t("shortcuts.go_settings_direct", "Go to Settings")}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h3 className="mb-3 [font-family:var(--font-display)] text-sm uppercase tracking-[0.06em] text-text-secondary">{t("common.global")}</h3>
            <dl className="flex flex-col gap-2">
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-[100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">Shift</kbd>
                  <span>+</span>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">?</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">{t("shortcuts.toggle_help", "Toggle this help")}</dd>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">Esc</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">{t("shortcuts.close_dialogs", "Close dialogs / Cancel")}</dd>
              </div>
            </dl>
          </section>
          {shortcuts.length > 0 && (
            <section>
              <h3 className="mb-3 [font-family:var(--font-display)] text-sm uppercase tracking-[0.06em] text-text-secondary">{t("common.page_specific")}</h3>
              <dl className="flex flex-col gap-2">
                {shortcuts.map((s) => (
                  <div key={s.key} className="flex items-center gap-4 text-sm">
                    <dt className="flex min-w-[100px] items-center gap-1">
                      <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">{s.key}</kbd>
                    </dt>
                    <dd className="m-0 text-text-secondary">{s.description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </section>
    </button>
  );
}
