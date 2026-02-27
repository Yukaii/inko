import { useState } from "react";
import { useAuth } from "../hooks/useAuth.js";

export function SettingsPage() {
  const { setToken } = useAuth();
  const [activeSection, setActiveSection] = useState<"general" | "account" | "about">("general");

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Customize your experience</p>
      </header>

      <div className="settings-layout">
        {/* Settings Navigation */}
        <nav className="settings-nav">
          <button
            type="button"
            className={`settings-nav-item ${activeSection === "general" ? "active" : ""}`}
            onClick={() => setActiveSection("general")}
          >
            General
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeSection === "account" ? "active" : ""}`}
            onClick={() => setActiveSection("account")}
          >
            Account
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeSection === "about" ? "active" : ""}`}
            onClick={() => setActiveSection("about")}
          >
            About
          </button>
        </nav>

        {/* Settings Content */}
        <div className="settings-content">
          {activeSection === "general" && (
            <section className="settings-section">
              <h2 className="section-title">General</h2>
              
              <div className="settings-group">
                <div className="setting-item">
                  <div className="setting-info">
                    <span className="setting-label">Language</span>
                    <span className="setting-description">Currently fixed to Japanese</span>
                  </div>
                  <span className="setting-value">日本語</span>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <span className="setting-label">Theme</span>
                    <span className="setting-description">Dark mode only for now</span>
                  </div>
                  <span className="setting-value">Dark</span>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <span className="setting-label">Keyboard Hints</span>
                    <span className="setting-description">Show shortcut keys in UI</span>
                  </div>
                  <span className="setting-value">Enabled</span>
                </div>
              </div>
            </section>
          )}

          {activeSection === "account" && (
            <section className="settings-section">
              <h2 className="section-title">Account</h2>
              
              <div className="settings-group">
                <div className="setting-item">
                  <div className="setting-info">
                    <span className="setting-label">Authentication</span>
                    <span className="setting-description">Managed via Convex Auth</span>
                  </div>
                </div>
              </div>

              <div className="settings-actions">
                <button type="button" className="danger-btn" onClick={() => setToken(null)}>
                  Sign Out
                </button>
              </div>
            </section>
          )}

          {activeSection === "about" && (
            <section className="settings-section">
              <h2 className="section-title">About</h2>
              
              <div className="about-content">
                <div className="about-logo">
                  <span lang="ja">inkō</span>
                </div>
                <p className="about-description">
                  A minimal, focused Japanese typing practice app inspired by monkeytype.
                </p>
                <div className="about-meta">
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
