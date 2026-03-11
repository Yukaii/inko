/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_AUTH_GOOGLE_ENABLED?: string;
  readonly VITE_AUTH_GITHUB_ENABLED?: string;
  readonly VITE_AUTH_APPLE_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// NOTE: prevent exposing secrets! This is just for some easy debug on production
interface Window {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
  __INKO_ENV__?: {
    apiUrl?: string;
    authGoogleEnabled?: string;
    authGithubEnabled?: string;
    authAppleEnabled?: string;
  };
}
