import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

export function SettingsPage() {
  const { setToken } = useAuth();
  const [activeSection, setActiveSection] = useState<"general" | "account" | "about">("general");

  return (
    <div className="flex flex-col gap-8">
      <header className="mb-2">
        <h1 className="m-0 text-4xl font-semibold [font-family:var(--font-display)]">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">Customize your experience</p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_1fr]">
        {/* Settings Navigation */}
        <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
          <button
            type="button"
            className={`rounded-[10px] px-4 py-3 text-left text-sm transition-all ${activeSection === "general" ? "bg-bg-card font-medium text-text-primary" : "bg-transparent text-text-secondary hover:bg-bg-card hover:text-text-primary"}`}
            onClick={() => setActiveSection("general")}
          >
            General
          </button>
          <button
            type="button"
            className={`rounded-[10px] px-4 py-3 text-left text-sm transition-all ${activeSection === "account" ? "bg-bg-card font-medium text-text-primary" : "bg-transparent text-text-secondary hover:bg-bg-card hover:text-text-primary"}`}
            onClick={() => setActiveSection("account")}
          >
            Account
          </button>
          <button
            type="button"
            className={`rounded-[10px] px-4 py-3 text-left text-sm transition-all ${activeSection === "about" ? "bg-bg-card font-medium text-text-primary" : "bg-transparent text-text-secondary hover:bg-bg-card hover:text-text-primary"}`}
            onClick={() => setActiveSection("about")}
          >
            About
          </button>
        </nav>

        {/* Settings Content */}
        <div className="rounded-base bg-bg-card p-7">
          {activeSection === "general" && (
            <section className="flex flex-col gap-6">
              <h2 className="m-0 text-[22px] font-semibold [font-family:var(--font-display)]">General</h2>
              
              <div className="flex flex-col gap-0">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Typing Mode</span>
                    <span className="text-[13px] text-text-secondary">Global preference for practice matching across all decks</span>
                  </div>
                  <Link to="/profile" className="font-mono text-xs text-accent-orange hover:underline">
                    Configure
                  </Link>
                </div>

                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Theme</span>
                    <span className="text-[13px] text-text-secondary">Use Profile to toggle and customize dark/light palettes</span>
                  </div>
                  <Link to="/profile" className="font-mono text-xs text-accent-orange hover:underline">
                    Theme Editor
                  </Link>
                </div>

                <div className="flex items-center justify-between py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Keyboard Hints</span>
                    <span className="text-[13px] text-text-secondary">Show shortcut keys in UI</span>
                  </div>
                  <span className="font-mono text-sm text-text-secondary">Enabled</span>
                </div>
              </div>
            </section>
          )}

          {activeSection === "account" && (
            <section className="flex flex-col gap-6">
              <h2 className="m-0 text-[22px] font-semibold [font-family:var(--font-display)]">Account</h2>
              
              <div className="flex flex-col gap-0">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Profile</span>
                    <span className="text-[13px] text-text-secondary">View account details and session controls</span>
                  </div>
                  <Link to="/profile" className="font-mono text-xs text-accent-orange hover:underline">
                    Open Profile
                  </Link>
                </div>
              </div>

              <div className="border-t border-[var(--border-subtle)] pt-4">
                <button type="button" className="bg-[var(--danger-bg)] text-[var(--danger-text)] hover:bg-[var(--danger-bg-hover)]" onClick={() => setToken(null)}>
                  Sign Out
                </button>
              </div>
            </section>
          )}

          {activeSection === "about" && (
            <section className="flex flex-col gap-6">
              <h2 className="m-0 text-[22px] font-semibold [font-family:var(--font-display)]">About</h2>
              
              <div className="py-5 text-center">
                <div className="mb-4 text-5xl text-accent-orange [font-family:var(--font-display)]">
                  <span lang="ja">inkō</span>
                </div>
                <p className="m-0 mb-5 text-sm leading-relaxed text-text-secondary">
                  A minimal, focused language typing practice app inspired by monkeytype.
                </p>
                <div className="flex justify-center gap-3 font-mono text-xs text-text-secondary">
                  <span>Version 0.1.0</span>
                  <span>·</span>
                  <span>MVP Release</span>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
