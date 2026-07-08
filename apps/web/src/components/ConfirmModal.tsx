import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

export function ConfirmModal({
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleEscape);
    confirmButtonRef.current?.focus();
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  const handleOverlayKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <button
      type="button"
      className="fixed inset-0 z-[1000] flex w-full cursor-default items-center justify-center border-0 bg-[var(--overlay-bg-strong)] p-5"
      onClick={onCancel}
      onKeyDown={handleOverlayKeyDown}
      aria-label={cancelLabel ?? t("common.cancel")}
    >
      <section
        className="max-h-[80vh] w-full max-w-[420px] overflow-y-auto rounded-xl border border-[var(--border-strong)] bg-bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onCancel();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 id="confirm-modal-title" className="m-0 text-base font-semibold text-text-primary">
            {title}
          </h2>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-bg-page p-0 text-text-secondary transition-colors hover:text-text-primary"
            onClick={onCancel}
            aria-label={cancelLabel ?? t("common.cancel")}
          >
            <X className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </header>
        {description ? (
          <p className="m-0 px-5 py-4 text-sm leading-6 text-text-secondary">{description}</p>
        ) : null}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <button
            type="button"
            className="rounded-lg border border-[var(--border-strong)] bg-bg-page px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent-orange"
            onClick={onCancel}
          >
            {cancelLabel ?? t("common.cancel")}
          </button>
          <button
            type="button"
            ref={confirmButtonRef}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-text-on-accent transition-opacity hover:opacity-90 ${
              danger ? "bg-[var(--danger-text)]" : "bg-accent-orange"
            }`}
            onClick={onConfirm}
          >
            {confirmLabel ?? t("common.delete")}
          </button>
        </div>
      </section>
    </button>
  );
}
