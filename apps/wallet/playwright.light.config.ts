import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Lightweight Playwright config for LLM-driven UI verification.
 *
 * Auth bypassed via pre-seeded localStorage storageState.
 * Backend/RPC/analytics routes mocked in fixtures.
 *
 * Prerequisites: Dev server running (bun dev / sst dev)
 *
 * Usage:
 *   bunx playwright test --config playwright.light.config.ts
 *   bunx playwright test --config playwright.light.config.ts --grep "wallet"
 *   bunx playwright test --config playwright.light.config.ts --ui
 */
export default defineConfig({
    testDir: "./tests-light/specs",
    testMatch: "**/*.check.ts",
    outputDir: join(__dirname, "test-results-light"),

    projects: [
        {
            name: "chromium-light",
            use: {
                ...devices["Desktop Chrome"],
                storageState: join(
                    __dirname,
                    "tests-light",
                    "mocks",
                    "authenticated-state.json"
                ),
            },
        },
    ],

    use: {
        baseURL:
            process.env.LIGHT_BASE_URL ??
            (process.env.ATELIER_SANDBOX_ID
                ? "http://localhost:3001"
                : "https://localhost:3000"),
        screenshot: "on",
        video: "off",
        trace: "off",
        ignoreHTTPSErrors: true,
        actionTimeout: 8_000,
        navigationTimeout: 15_000,
    },

    fullyParallel: true,
    retries: 0,
    reporter: [["list"], ["html", { open: "never" }]],
    forbidOnly: !!process.env.CI,
});
