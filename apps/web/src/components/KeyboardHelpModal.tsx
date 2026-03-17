import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

export function KeyboardHelpModal({
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
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
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

  const handleOverlayKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
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
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
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
                <dt className="flex min-w-[100px] items-center gap-1">
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
                {shortcuts.map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center gap-4 text-sm">
                    <dt className="flex min-w-[100px] items-center gap-1">
                      <kbd className="rounded border border-[color:color-mix(in_oklab,var(--text-secondary)_50%,var(--bg-page))] bg-bg-elevated px-2 py-[3px] font-mono text-xs text-text-primary">{shortcut.key}</kbd>
                    </dt>
                    <dd className="m-0 text-text-secondary">{shortcut.description}</dd>
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
