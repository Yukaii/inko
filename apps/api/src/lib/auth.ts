import { jwtVerify, SignJWT } from "jose";
import { randomBytes } from "node:crypto";
import { env } from "./env.js";

type MagicTokenRecord = {
  email: string;
  expiresAt: number;
};

const magicTokens = new Map<string, MagicTokenRecord>();
const secret = new TextEncoder().encode(env.JWT_SECRET);

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

export function createMagicToken(email: string): string {
  const token = randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 15 * 60 * 1000;
  magicTokens.set(token, { email, expiresAt });
  return token;
}

export function consumeMagicToken(token: string): string | null {
  const record = magicTokens.get(token);
  if (!record) return null;
  magicTokens.delete(token);
  if (record.expiresAt < Date.now()) {
    return null;
  }
  return record.email;
}
