/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_GOOGLE_ENABLED?: string;
  readonly VITE_AUTH_GITHUB_ENABLED?: string;
  readonly VITE_AUTH_APPLE_ENABLED?: string;
  readonly VITE_CONVEX_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// NOTE: prevent exposing secrets! This is just for some easy debug on production
interface Window {
  __INKO_ENV__?: {
    apiUrl?: string;
    convexUrl?: string;
    authGoogleEnabled?: string;
    authGithubEnabled?: string;
    authAppleEnabled?: string;
  };
}
