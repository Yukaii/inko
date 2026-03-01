import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["images/generated-1772173662547.png"],
      manifest: {
        name: "Inko",
        short_name: "Inko",
        description: "Practice vocabulary with typing-first drills, spaced repetition, and audio support.",
        theme_color: "#1a1a1a",
        background_color: "#111111",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/images/generated-1772173662547.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
