import { Resend } from "resend";
import { env } from "./env";

const MAGIC_LINK_EXPIRY_MINUTES = 15;

export type MagicLinkMail = {
  email: string;
  token: string;
};

export type Mailer = {
  kind: "log" | "resend";
  sendMagicLink: (mail: MagicLinkMail) => Promise<void>;
};

export function buildMagicLinkVerifyUrl(token: string): string {
  const url = new URL(env.MAGIC_LINK_LOGIN_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

export function createMailer(): Mailer {
  if (env.MAIL_PROVIDER === "resend") {
    const resend = new Resend(env.RESEND_API_KEY);

    return {
      kind: "resend",
      sendMagicLink: async ({ email, token }) => {
        const verifyUrl = buildMagicLinkVerifyUrl(token);
        const subject = "Your Inkō sign-in link";
        const text = [
          `Use this link to sign in to Inkō (expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes):`,
          verifyUrl,
          "",
          `If the link doesn't open the app, paste this token manually: ${token}`,
        ].join("\n");

        await resend.emails.send({
          from: env.MAIL_FROM,
          to: email,
          subject,
          text,
          html: `<p>Use this link to sign in to Inkō (expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes):</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>If the link doesn't open the app, paste this token manually:</p><pre>${token}</pre>`,
        });
      },
    };
  }

  return {
    kind: "log",
    sendMagicLink: async ({ email, token }) => {
      const verifyUrl = buildMagicLinkVerifyUrl(token);
      console.info("[mail:log] magic link", { email, token, verifyUrl });
    },
  };
}
