import { describe, expect, it } from "vitest";
import { createInMemoryMagicTokenStore, issueAccessToken, verifyAccessToken } from "./auth";

describe("auth", () => {
  it("issues and verifies access token", async () => {
    const token = await issueAccessToken("user_1", "user@example.com");
    const payload = await verifyAccessToken(token);
    expect(payload.userId).toBe("user_1");
    expect(payload.email).toBe("user@example.com");
  });

  it("creates and consumes magic token once", async () => {
    const store = createInMemoryMagicTokenStore();
    const token = await store.create("user@example.com");
    expect(await store.consume(token)).toBe("user@example.com");
    expect(await store.consume(token)).toBeNull();
  });
});
