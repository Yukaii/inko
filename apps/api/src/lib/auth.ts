import { jwtVerify, SignJWT } from "jose";
import { randomBytes } from "node:crypto";
import { getDb } from "../db/client";
import { env } from "./env";

const secret = new TextEncoder().encode(env.JWT_SECRET);
const db = getDb();

export type MagicTokenStore = {
  create: (email: string) => Promise<string>;
  consume: (token: string) => Promise<string | null>;
};

export async function issueAccessToken(userId: string, email: string): Promise<string> {
  return await new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<{ userId: string; email: string }> {
  const { payload } = await jwtVerify(token, secret);
  return {
    userId: String(payload.sub),
    email: String(payload.email),
  };
}

export function createInMemoryMagicTokenStore(): MagicTokenStore {
  const magicTokens = new Map<string, { email: string; expiresAt: number }>();

  return {
    async create(email: string) {
      const token = randomBytes(24).toString("hex");
      magicTokens.set(token, { email, expiresAt: Date.now() + 15 * 60 * 1000 });
      return token;
    },

    async consume(token: string) {
      const record = magicTokens.get(token);
      if (!record) return null;
      magicTokens.delete(token);
      if (record.expiresAt < Date.now()) {
        return null;
      }
      return record.email;
    },
  };
}

export const magicTokenStore: MagicTokenStore = {
  async create(email: string) {
    const token = randomBytes(24).toString("hex");
    const now = Date.now();

    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom("magic_link_tokens").where("email", "=", email).execute();
      await trx.insertInto("magic_link_tokens").values({
        token,
        email,
        expires_at: now + 15 * 60 * 1000,
        created_at: now,
      }).execute();
    });

    return token;
  },

  async consume(token: string) {
    const record = await db.transaction().execute(async (trx) => {
      const existing = await trx
        .selectFrom("magic_link_tokens")
        .select(["email", "expires_at"])
        .where("token", "=", token)
        .executeTakeFirst();

      if (!existing) {
        return null;
      }

      await trx.deleteFrom("magic_link_tokens").where("token", "=", token).execute();
      await trx.deleteFrom("magic_link_tokens").where("expires_at", "<", Date.now()).execute();

      return existing;
    });

    if (!record || Number(record.expires_at) < Date.now()) {
      return null;
    }

    return record.email;
  },
};
