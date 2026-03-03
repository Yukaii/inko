import { useCallback, useEffect, useRef, useState } from "react";

export type ShortcutHandler = (event: KeyboardEvent) => void;

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  description: string;
  scope?: "global" | "local";
}

class KeyboardManager {
  private shortcuts: Map<string, Shortcut> = new Map();
  private enabled = true;

  register(shortcut: Shortcut) {
    const key = this.getKey(shortcut);
    this.shortcuts.set(key, shortcut);
    return () => this.unregister(key);
  }

  unregister(key: string) {
    this.shortcuts.delete(key);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  private getKey(s: Shortcut): string {
    const parts: string[] = [];
    if (s.ctrl) parts.push("ctrl");
    if (s.meta) parts.push("meta");
    if (s.alt) parts.push("alt");
    if (s.shift) parts.push("shift");
    parts.push(s.key.toLowerCase());
    return parts.join("+");
  }

  handle(event: KeyboardEvent) {
    if (!this.enabled) return;
    if (typeof event.key !== "string" || event.key.length === 0) return;

    const parts: string[] = [];
    if (event.ctrlKey) parts.push("ctrl");
    if (event.metaKey) parts.push("meta");
    if (event.altKey) parts.push("alt");
    if (event.shiftKey) parts.push("shift");
    parts.push(event.key.toLowerCase());
    const key = parts.join("+");

    const shortcut = this.shortcuts.get(key);
    if (shortcut) {
      // Don't trigger global shortcuts when typing in inputs (except Escape)
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true";

      if (isInput && shortcut.scope !== "local" && event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      shortcut.handler(event);
    }
  }

  getAllShortcuts(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }
}

export const keyboardManager = new KeyboardManager();

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyboardManager.handle(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

export function registerShortcut(shortcut: Shortcut) {
  return keyboardManager.register(shortcut);
}

export function getShortcutsList(): Array<{ key: string; description: string }> {
  return keyboardManager.getAllShortcuts().map((s) => ({
    key: formatShortcutKey(s),
    description: s.description,
  }));
}

function formatShortcutKey(s: Shortcut): string {
  const parts: string[] = [];
  if (s.ctrl) parts.push("Ctrl");
  if (s.meta) parts.push("⌘");
  if (s.alt) parts.push("Alt");
  if (s.shift) parts.push("Shift");
  parts.push(s.key === " " ? "Space" : s.key);
  return parts.join(" + ");
}
