import { describe, expect, it } from "vitest";
import { DEFAULT_SRS_CONFIG } from "./schemas";
import { applyAttempt, defaultWordChannelStats, weakestChannel } from "./scheduling";

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

  it("applies custom srs config for starting strength and interval sizing", () => {
    const now = Date.now();
    const config = {
      ...DEFAULT_SRS_CONFIG,
      startingStrength: 30,
      strengthStepDivisor: 2,
      intervalLowMinutes: 15,
    };
    const stats = defaultWordChannelStats(now, config);
    const next = applyAttempt(stats, { shape: 100, typing: 60, listening: 60 }, now, config);

    expect(stats.shape.strength).toBe(30);
    expect(next.shape.strength).toBeGreaterThan(30);
    expect(next.typing.dueAt).toBe(now + config.intervalLowMinutes * 60 * 1000);
  });
});
