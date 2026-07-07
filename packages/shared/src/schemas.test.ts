import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_SRS_CONFIG, normalizeSrsConfig } from "./schemas";

describe("normalizeSrsConfig", () => {
  it("keeps current minute-based config values", () => {
    const config = {
      ...DEFAULT_SRS_CONFIG,
      intervalLowMinutes: 20,
      intervalMidMinutes: 60,
    };

    expect(normalizeSrsConfig(config)).toEqual(config);
  });

  it("converts legacy hour-based interval values to minutes", () => {
    expect(
      normalizeSrsConfig({
        startingStrength: 50,
        strengthStepDivisor: 4,
        intervalLowHours: 12,
        intervalMidHours: 24,
        intervalStrongHours: 48,
        intervalMasteredHours: 96,
        intervalExpertHours: 168,
      }),
    ).toEqual({
      startingStrength: 50,
      strengthStepDivisor: 4,
      intervalLowMinutes: 720,
      intervalMidMinutes: 1440,
      intervalStrongMinutes: 2880,
      intervalMasteredMinutes: 5760,
      intervalExpertMinutes: 10080,
    });
  });
});
