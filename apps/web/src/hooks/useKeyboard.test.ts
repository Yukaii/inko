/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getShortcutsList, keyboardManager, registerShortcut } from "./useKeyboard";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe("keyboard shortcuts", () => {
  it("matches shifted question mark shortcuts", () => {
    const handler = vi.fn();
    cleanups.push(
      registerShortcut({
        key: "?",
        shift: true,
        handler,
        description: "Toggle shortcuts",
        scope: "global",
      }),
    );

    keyboardManager.handle(new KeyboardEvent("keydown", { key: "?", shiftKey: true }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("omits global shell shortcuts from page-specific shortcut list", () => {
    cleanups.push(
      registerShortcut({
        key: "1",
        handler: vi.fn(),
        description: "Go to Dashboard",
        scope: "global",
      }),
    );
    cleanups.push(
      registerShortcut({
        key: "p",
        handler: vi.fn(),
        description: "Focus practice decks",
      }),
    );

    expect(getShortcutsList()).toEqual([{ key: "p", description: "Focus practice decks" }]);
  });
});
