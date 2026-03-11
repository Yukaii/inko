import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import "./i18n";
import "./styles/theme.css";
import { applyThemePreferences, loadThemePreferences } from "./theme/theme";

const queryClient = new QueryClient();
applyThemePreferences(loadThemePreferences());

const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

if (gaMeasurementId) {
  const gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`;
  document.head.appendChild(gaScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", gaMeasurementId);
}

window.__INKO_ENV__ = {
  apiUrl: import.meta.env.VITE_API_URL,
  authGoogleEnabled: import.meta.env.VITE_AUTH_GOOGLE_ENABLED,
  authGithubEnabled: import.meta.env.VITE_AUTH_GITHUB_ENABLED,
  authAppleEnabled: import.meta.env.VITE_AUTH_APPLE_ENABLED,
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
