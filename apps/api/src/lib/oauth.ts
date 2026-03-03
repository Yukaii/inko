import { jwtVerify, SignJWT } from "jose";
import { env } from "./env";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export type OAuthProvider = "github" | "google";

type OAuthStatePayload = {
  provider: OAuthProvider;
  redirectTo: string;
};

type OAuthIdentity = {
  email: string;
};

function sanitizeRedirectTo(redirectTo?: string) {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "/dashboard";
  }
  return redirectTo;
}

function buildAbsoluteUrl(request: { headers: Record<string, string | string[] | undefined> }, path: string) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const forwardedHost = request.headers["x-forwarded-host"];
  const host = typeof forwardedHost === "string" ? forwardedHost : request.headers.host;
  const proto = typeof forwardedProto === "string" ? forwardedProto : "http";
  if (!host) {
    throw new Error("Missing host header");
  }
  return `${proto}://${host}${path}`;
}

export async function createOAuthState(provider: OAuthProvider, redirectTo?: string) {
  return await new SignJWT({
    provider,
    redirectTo: sanitizeRedirectTo(redirectTo),
  } satisfies OAuthStatePayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);
}

export async function verifyOAuthState(token: string): Promise<OAuthStatePayload> {
  const { payload } = await jwtVerify(token, secret);
  const provider = payload.provider;
  if (provider !== "github" && provider !== "google") {
    throw new Error("Invalid OAuth provider");
  }
  return {
    provider,
    redirectTo: sanitizeRedirectTo(typeof payload.redirectTo === "string" ? payload.redirectTo : undefined),
  };
}

function assertProviderConfigured(provider: OAuthProvider) {
  if (provider === "github") {
    if (!env.AUTH_GITHUB_ID || !env.AUTH_GITHUB_SECRET) {
      throw new Error("GitHub OAuth is not configured");
    }
    return {
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    };
  }

  if (!env.AUTH_GOOGLE_ID || !env.AUTH_GOOGLE_SECRET) {
    throw new Error("Google OAuth is not configured");
  }
  return {
    clientId: env.AUTH_GOOGLE_ID,
    clientSecret: env.AUTH_GOOGLE_SECRET,
  };
}

export async function buildOAuthAuthorizationUrl(
  provider: OAuthProvider,
  request: { headers: Record<string, string | string[] | undefined> },
  redirectTo?: string,
) {
  const config = assertProviderConfigured(provider);
  const state = await createOAuthState(provider, redirectTo);
  const callbackUrl = buildAbsoluteUrl(request, `/api/auth/${provider}/callback`);

  if (provider === "github") {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    return url.toString();
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeGithubCode(request: { headers: Record<string, string | string[] | undefined> }, code: string) {
  const config = assertProviderConfigured("github");
  const callbackUrl = buildAbsoluteUrl(request, "/api/auth/github/callback");
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "inko-auth",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: callbackUrl,
    }),
  });

  const tokenBody = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string };
  if (!tokenResponse.ok || !tokenBody.access_token) {
    throw new Error(tokenBody.error_description || tokenBody.error || "Failed to exchange GitHub OAuth code");
  }

  const emailResponse = await fetch("https://api.github.com/user/emails", {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${tokenBody.access_token}`,
      "user-agent": "inko-auth",
    },
  });
  const emails = await emailResponse.json() as Array<{ email: string; verified: boolean; primary: boolean }>;
  const primary = emails.find((entry) => entry.primary && entry.verified) ?? emails.find((entry) => entry.verified);
  if (!primary?.email) {
    throw new Error("GitHub account does not have a verified email");
  }

  return { email: primary.email.toLowerCase() } satisfies OAuthIdentity;
}

async function exchangeGoogleCode(request: { headers: Record<string, string | string[] | undefined> }, code: string) {
  const config = assertProviderConfigured("google");
  const callbackUrl = buildAbsoluteUrl(request, "/api/auth/google/callback");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
    }),
  });

  const tokenBody = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string };
  if (!tokenResponse.ok || !tokenBody.access_token) {
    throw new Error(tokenBody.error_description || tokenBody.error || "Failed to exchange Google OAuth code");
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      authorization: `Bearer ${tokenBody.access_token}`,
    },
  });
  const profile = await profileResponse.json() as { email?: string; email_verified?: boolean };
  if (!profileResponse.ok || !profile.email || profile.email_verified === false) {
    throw new Error("Google account does not have a verified email");
  }

  return { email: profile.email.toLowerCase() } satisfies OAuthIdentity;
}

export async function exchangeOAuthCodeForIdentity(
  provider: OAuthProvider,
  request: { headers: Record<string, string | string[] | undefined> },
  code: string,
) {
  if (provider === "github") {
    return await exchangeGithubCode(request, code);
  }
  return await exchangeGoogleCode(request, code);
}

export function buildFrontendOAuthSuccessUrl(accessToken: string, redirectTo: string) {
  const url = new URL(env.FRONTEND_URL);
  url.pathname = redirectTo;
  url.searchParams.set("accessToken", accessToken);
  return url.toString();
}

export function buildFrontendOAuthErrorUrl(message: string) {
  const url = new URL(env.MAGIC_LINK_LOGIN_URL);
  url.searchParams.set("error", message);
  return url.toString();
}
