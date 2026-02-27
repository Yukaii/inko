import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          orange: "#ff6b35",
          teal: "#00d4aa",
        },
        bg: {
          page: "#1a1a1a",
          card: "#212121",
          elevated: "#2d2d2d",
          placeholder: "#3d3d3d",
        },
        text: {
          primary: "#ffffff",
          secondary: "#777777",
          "on-accent": "#0d0d0d",
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
