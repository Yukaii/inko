import { defineConfig } from "@playwright/test";
export default defineConfig({
    testDir: "../../test/e2e",
    use: {
        baseURL: "http://localhost:5173",
        headless: true,
    },
});
