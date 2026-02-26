import { describe, expect, it } from "vitest";
import { applyAttempt, defaultWordChannelStats, weakestChannel } from "./scheduling.js";

describe("scheduling", () => {
  it("updates channel strengths and due dates", () => {
    const now = Date.now();
    const current = defaultWordChannelStats(now);
    const next = applyAttempt(current, { shape: 100, typing: 70, listening: 20 }, now);

    expect(next.shape.strength).toBeGreaterThan(current.shape.strength);
    expect(next.listening.strength).toBeLessThan(current.listening.strength);
    expect(next.shape.dueAt).toBeGreaterThan(now);
  });

  it("finds weakest channel", () => {
    const now = Date.now();
    const stats = defaultWordChannelStats(now);
    const next = applyAttempt(stats, { shape: 100, typing: 100, listening: 20 }, now);
    expect(weakestChannel(next)).toBe("listening");
  });
});
