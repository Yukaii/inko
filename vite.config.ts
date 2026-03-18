import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    exclude: ["**/dist/**", "test/e2e/**"],
    include: [
      "apps/*/src/**/*.{test,spec}.ts",
      "apps/*/src/**/*.{test,spec}.tsx",
      "packages/*/src/**/*.{test,spec}.ts",
      "packages/*/src/**/*.{test,spec}.tsx",
    ],
  },
});
