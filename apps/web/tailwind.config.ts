import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          orange: "var(--accent-orange)",
          teal: "var(--accent-teal)",
        },
        bg: {
          page: "var(--bg-page)",
          card: "var(--bg-card)",
          elevated: "var(--bg-elevated)",
          placeholder: "color-mix(in oklab, var(--text-secondary) 60%, var(--bg-page))",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          "on-accent": "var(--text-on-accent)",
        },
      },
      borderRadius: {
        base: "16px",
      },
      fontFamily: {
        display: ["Oswald", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        jp: ["Noto Sans JP", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
