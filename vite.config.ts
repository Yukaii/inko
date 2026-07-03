import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

const sharedSrc = fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@inko/shared": sharedSrc,
    },
  },
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
