import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { registerShortcut, getShortcutsList } from "../hooks/useKeyboard.js";

const NAV_LINKS = [
  { to: "/dashboard", label: "dashboard", key: "d" },
  { to: "/word-bank", label: "word_bank", key: "w" },
  { to: "/settings", label: "settings", key: "s" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showHelp, setShowHelp] = useState(false);

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
        description: "Go to page (g then d/w/s)",
      })
    );

    // Direct number shortcuts (1, 2, 3 for nav)
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo" role="banner">
          <span lang="ja">inkō</span>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          {NAV_LINKS.map((link, index) => (
            <NavLink
              key={link.to}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              to={link.to}
              tabIndex={0}
              aria-current={location.pathname === link.to ? "page" : undefined}
            >
              <span className="nav-link-label">{link.label}</span>
              <kbd className="nav-link-shortcut" aria-label={`Shortcut: press ${index + 1}`}>
                {index + 1}
              </kbd>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="keyboard-help-btn"
            onClick={() => setShowHelp(true)}
            aria-label="Show keyboard shortcuts (Shift+?)"
          >
            <kbd>?</kbd>
            <span>shortcuts</span>
          </button>
        </div>
      </aside>

      <main className="main" tabIndex={-1}>
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
      className="keyboard-help-overlay"
      onClick={onClose}
      onKeyDown={handleOverlayKeyDown}
      aria-label="Close keyboard shortcuts help"
    >
      <section
        ref={modalRef}
        className="keyboard-help-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <header className="keyboard-help-header">
          <h2>Keyboard Shortcuts</h2>
          <button type="button" className="keyboard-help-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="keyboard-help-content">
          <section>
            <h3>Navigation</h3>
            <dl className="keyboard-shortcuts-list">
              <div className="keyboard-shortcut-row">
                <dt>
                  <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>
                </dt>
                <dd>Go to Dashboard / Word Bank / Settings</dd>
              </div>
              <div className="keyboard-shortcut-row">
                <dt>
                  <kbd>g</kbd> <span>then</span> <kbd>d</kbd>
                </dt>
                <dd>Go to Dashboard</dd>
              </div>
              <div className="keyboard-shortcut-row">
                <dt>
                  <kbd>g</kbd> <span>then</span> <kbd>w</kbd>
                </dt>
                <dd>Go to Word Bank</dd>
              </div>
              <div className="keyboard-shortcut-row">
                <dt>
                  <kbd>g</kbd> <span>then</span> <kbd>s</kbd>
                </dt>
                <dd>Go to Settings</dd>
              </div>
            </dl>
          </section>
          <section>
            <h3>Global</h3>
            <dl className="keyboard-shortcuts-list">
              <div className="keyboard-shortcut-row">
                <dt>
                  <kbd>Shift</kbd> + <kbd>?</kbd>
                </dt>
                <dd>Toggle this help</dd>
              </div>
              <div className="keyboard-shortcut-row">
                <dt>
                  <kbd>Esc</kbd>
                </dt>
                <dd>Close dialogs / Cancel</dd>
              </div>
            </dl>
          </section>
          {shortcuts.length > 0 && (
            <section>
              <h3>Page Specific</h3>
              <dl className="keyboard-shortcuts-list">
                {shortcuts.map((s) => (
                  <div key={s.key} className="keyboard-shortcut-row">
                    <dt>
                      <kbd>{s.key}</kbd>
                    </dt>
                    <dd>{s.description}</dd>
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
