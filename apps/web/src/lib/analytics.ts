export function initGoogleAnalytics(measurementId?: string) {
  if (!measurementId) {
    return;
  }

  const gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(gaScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer?.push(arguments as unknown);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId);
}
