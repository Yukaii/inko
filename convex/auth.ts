import Apple from "@auth/core/providers/apple";
import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { DefaultThemes } from "@inko/shared";
import { convexAuth } from "@convex-dev/auth/server";

function fallbackDisplayName(email: string) {
  const localPart = email.split("@")[0] ?? "learner";
  const normalized = localPart.replace(/[._-]+/g, " ").trim();
  return normalized.length > 0 ? normalized : "learner";
}

function getEnabledProviders() {
  const providers = [];

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
    );
  }

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      }),
    );
  }

  if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
    providers.push(
      Apple({
        clientId: process.env.AUTH_APPLE_ID,
        clientSecret: process.env.AUTH_APPLE_SECRET,
      }),
    );
  }

  return providers;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: getEnabledProviders(),
  jwt: {
    async customClaims(ctx, { userId }) {
      const user = await ctx.db.get(userId);
      return {
        email: user?.email,
      };
    },
  },
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      const email = profile.email?.toLowerCase();
      if (!email) {
        throw new Error("This sign-in provider did not return an email address.");
      }

      const now = Date.now();
      const displayName =
        typeof profile.name === "string" && profile.name.trim().length > 0
          ? profile.name.trim().slice(0, 60)
          : fallbackDisplayName(email).slice(0, 60);
      const image = typeof profile.image === "string" ? profile.image : undefined;
      const verifiedAt = profile.emailVerified ? now : undefined;

      const existingByEmail = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      const userId = existingUserId ?? existingByEmail?._id ?? null;

      if (userId) {
        await ctx.db.patch(userId, {
          email,
          emailVerificationTime: verifiedAt,
          name: displayName,
          image,
          displayName,
        });
        return userId;
      }

      return await ctx.db.insert("users", {
        email,
        emailVerificationTime: verifiedAt,
        name: displayName,
        image,
        displayName,
        themeMode: "dark",
        typingMode: "language_specific",
        ttsEnabled: true,
        themes: DefaultThemes,
        createdAt: now,
      });
    },
    async redirect({ redirectTo }) {
      return redirectTo;
    },
  },
});
