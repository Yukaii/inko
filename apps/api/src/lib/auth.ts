import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { randomBytes } from "node:crypto";
import { env } from "./env";

type MagicTokenRecord = {
  email: string;
  expiresAt: number;
};

const magicTokens = new Map<string, MagicTokenRecord>();
const secret = new TextEncoder().encode(env.JWT_SECRET);
const convexIssuer = env.CONVEX_SITE_URL.replace(/\/$/, "");
const convexJwksUrl = new URL(`${convexIssuer}/.well-known/jwks.json`);
const convexJwks = createRemoteJWKSet(convexJwksUrl);

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

export async function verifyConvexAccessToken(token: string): Promise<{ userId: string; email: string | null }> {
  const { payload } = await jwtVerify(token, convexJwks, {
    issuer: convexIssuer,
    audience: "convex",
  });

  const subject = typeof payload.sub === "string" ? payload.sub : "";
  const userId = subject.split("|")[0];
  if (!userId) {
    throw new Error("Invalid Convex auth subject");
  }

  return {
    userId,
    email: typeof payload.email === "string" ? payload.email : null,
  };
}

export function getConvexVerificationDebugInfo(token?: string) {
  const tokenParts = token?.split(".");
  const decodePart = (value?: string) => {
    if (!value) return null;
    try {
      return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    } catch {
      return null;
    }
  };

  return {
    configuredIssuer: convexIssuer,
    configuredJwksUrl: convexJwksUrl.toString(),
    tokenHeader: decodePart(tokenParts?.[0]),
    tokenPayload: decodePart(tokenParts?.[1]),
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
