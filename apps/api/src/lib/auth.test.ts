import { describe, expect, it } from "vitest";
import { consumeMagicToken, createMagicToken, issueAccessToken, verifyAccessToken } from "./auth.js";

describe("auth", () => {
  it("issues and verifies access token", async () => {
    const token = await issueAccessToken("user_1", "user@example.com");
    const payload = await verifyAccessToken(token);
    expect(payload.userId).toBe("user_1");
    expect(payload.email).toBe("user@example.com");
  });

  it("creates and consumes magic token once", () => {
    const token = createMagicToken("user@example.com");
    expect(consumeMagicToken(token)).toBe("user@example.com");
    expect(consumeMagicToken(token)).toBeNull();
  });
});
