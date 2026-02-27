import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ThemeConfig, ThemeMode } from "@inko/shared";
import { registerShortcut, getShortcutsList } from "../hooks/useKeyboard.js";
import { useAuth } from "../hooks/useAuth.js";
import { api } from "../api/client.js";
import { applyThemePreferences, saveThemePreferences } from "../theme/theme.js";

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

const NAV_LINKS = [
  { to: "/dashboard", label: "dashboard", mobileLabel: "Home", Icon: HomeIcon, key: "d" },
  { to: "/word-bank", label: "word_bank", mobileLabel: "Decks", Icon: DecksIcon, key: "w" },
  { to: "/profile", label: "profile", mobileLabel: "Profile", Icon: UserIcon, key: "p" },
  { to: "/settings", label: "settings", mobileLabel: "Settings", Icon: SettingsIcon, key: "s" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const [showHelp, setShowHelp] = useState(false);
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(token ?? ""),
    enabled: Boolean(token),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    const me = meQuery.data as { themeMode: ThemeMode; themes: ThemeConfig } | undefined;
    if (!me) return;
    const preferences = { themeMode: me.themeMode, themes: me.themes };
    applyThemePreferences(preferences);
    saveThemePreferences(preferences);
  }, [meQuery.data]);

  // Register global navigation shortcuts
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    // Navigation shortcuts (g + key)
    cleanups.push(
      registerShortcut({
        key: "g",
        handler: () => {
          // Wait for next key
          const handler = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            const link = NAV_LINKS.find((l) => l.key === key);
            if (link) {
              e.preventDefault();
              navigate(link.to);
            }
            window.removeEventListener("keydown", handler, { capture: true });
          };
          window.addEventListener("keydown", handler, { capture: true, once: true });
        },
        description: "Go to page (g then d/w/p/s)",
      }),
    );

    // Direct number shortcuts for nav links
    for (const [index, link] of NAV_LINKS.entries()) {
      cleanups.push(
        registerShortcut({
          key: String(index + 1),
          handler: () => navigate(link.to),
          description: `Go to ${link.label}`,
        })
      );
    }

    // Help shortcut
    cleanups.push(
      registerShortcut({
        key: "?",
        shift: true,
        handler: () => setShowHelp((prev) => !prev),
        description: "Toggle keyboard shortcuts help",
      })
    );

    // Escape to close help
    cleanups.push(
      registerShortcut({
        key: "Escape",
        handler: () => setShowHelp(false),
        description: "Close dialogs",
      })
    );

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [navigate]);

  const shortcuts = getShortcutsList();

  return (
    <div className="grid h-screen overflow-hidden md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-1 grid-cols-1 grid-rows-[1fr_auto]">
      {/* Desktop Sidebar */}
      <aside className="hidden h-screen flex-col gap-3 overflow-y-auto border-r border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-page p-6 md:flex">
        <div className="mb-4 text-[22px] text-accent-orange [font-family:var(--font-display)]" role="banner">
          <span lang="ja">inkō</span>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Main navigation">
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
              <span>{link.label}</span>
              <kbd
                className="shrink-0 rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-card px-1.5 py-0.5 font-mono text-[11px] text-text-secondary opacity-60 transition-all"
                aria-label={`Shortcut: press ${index + 1}`}
              >
                {index + 1}
              </kbd>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] pt-4">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-[10px] border border-dashed border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-transparent px-3.5 py-2.5 text-[13px] font-normal text-text-secondary transition-all hover:border-accent-orange hover:bg-bg-elevated hover:text-text-primary focus:border-accent-orange focus:bg-bg-elevated focus:text-text-primary"
            onClick={() => setShowHelp(true)}
            aria-label="Show keyboard shortcuts (Shift+?)"
          >
            <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-card px-1.5 py-0.5 font-mono text-[11px]">?</kbd>
            <span>shortcuts</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="fixed inset-x-0 bottom-0 z-[9999] flex h-16 items-center justify-around border-t border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-page px-2 shadow-[0_-2px_10px_color-mix(in_oklab,var(--text-primary)_18%,transparent)] md:hidden" aria-label="Mobile navigation">
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
              <span className="text-[11px] font-medium">{link.mobileLabel}</span>
            </NavLink>
          );
        })}

      </nav>

      <main id="main-content" className="h-screen overflow-y-auto px-5 pt-5 pb-[84px] md:px-10 md:py-8" tabIndex={-1}>
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
      aria-label="Close keyboard shortcuts help"
    >
      <section
        ref={modalRef}
        className="max-h-[80vh] w-full max-w-[500px] overflow-y-auto rounded-base border border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] bg-bg-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <header className="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--text-secondary)_40%,var(--bg-page))] px-6 py-5">
          <h2 className="[font-family:var(--font-display)] text-2xl text-text-primary">Keyboard Shortcuts</h2>
          <button type="button" className="border-0 bg-transparent p-1 text-2xl leading-none text-text-secondary transition-colors hover:text-text-primary focus:text-text-primary" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="flex flex-col gap-6 p-6">
          <section>
            <h3 className="mb-3 [font-family:var(--font-display)] text-sm uppercase tracking-[0.06em] text-text-secondary">Navigation</h3>
            <dl className="flex flex-col gap-2">
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-[100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">1</kbd>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">2</kbd>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">3</kbd>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">4</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">Go to Dashboard / Word Bank / Profile / Settings</dd>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-[100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">g</kbd>
                  <span className="text-xs text-text-secondary">then</span>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">d</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">Go to Dashboard</dd>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-[100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">g</kbd>
                  <span className="text-xs text-text-secondary">then</span>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">w</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">Go to Word Bank</dd>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-[100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">g</kbd>
                  <span className="text-xs text-text-secondary">then</span>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">p</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">Go to Profile</dd>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-[100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">g</kbd>
                  <span className="text-xs text-text-secondary">then</span>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">s</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">Go to Settings</dd>
              </div>
            </dl>
          </section>
          <section>
            <h3 className="mb-3 [font-family:var(--font-display)] text-sm uppercase tracking-[0.06em] text-text-secondary">Global</h3>
            <dl className="flex flex-col gap-2">
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-[100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">Shift</kbd>
                  <span>+</span>
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">?</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">Toggle this help</dd>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <dt className="flex min-w-[100px] items-center gap-1">
                  <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">Esc</kbd>
                </dt>
                <dd className="m-0 text-text-secondary">Close dialogs / Cancel</dd>
              </div>
            </dl>
          </section>
          {shortcuts.length > 0 && (
            <section>
              <h3 className="mb-3 [font-family:var(--font-display)] text-sm uppercase tracking-[0.06em] text-text-secondary">Page Specific</h3>
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
