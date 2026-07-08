import { useEffect, useRef, useState } from "react";
import { EllipsisVertical } from "lucide-react";

export type KebabMenuItem = {
  label: string;
  danger?: boolean;
  onClick: () => void;
};

export function KebabMenu({
  items,
  ariaLabel = "Actions",
}: {
  items: KebabMenuItem[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleItemClick = (onClick: () => void) => {
    setOpen(false);
    onClick();
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="flex size-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-bg-card p-0 text-text-secondary transition-colors hover:border-[var(--border-strong)] hover:bg-bg-elevated hover:text-text-primary"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <EllipsisVertical className="size-4 shrink-0" aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-lg border border-[var(--border-strong)] bg-bg-card py-1 shadow-xl"
          role="menu"
          aria-orientation="vertical"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                item.danger
                  ? "text-[var(--danger-text)] hover:bg-[var(--danger-bg)]"
                  : "text-text-primary hover:bg-bg-elevated"
              }`}
              role="menuitem"
              onClick={() => handleItemClick(item.onClick)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
