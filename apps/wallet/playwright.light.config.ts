import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SPA_BASE_URL =
    process.env.LIGHT_BASE_URL ??
    (process.env.ATELIER_SANDBOX_ID
        ? "http://localhost:3001"
        : "https://localhost:3000");

/** Port must agree with `serve-standalone.ts`, which reads the same var. */
const STANDALONE_PORT = Number(process.env.STANDALONE_PORT ?? 3100);
// The address Playwright connects to, which is not always the one the server
// binds: CI binds `0.0.0.0` (loopback does not cross a container's network
// namespace) but must still be reached at a concrete address. `127.0.0.1`
// rather than `localhost`, which can resolve to `::1` first.
const STANDALONE_BASE_URL = `http://127.0.0.1:${STANDALONE_PORT}`;

/** Specs driving the standalone bundle rather than the SPA. */
const STANDALONE_SPECS = ["**/sharing.check.ts", "**/install.check.ts"];

const storageState = join(
    __dirname,
    "tests-light",
    "mocks",
    "authenticated-state.json"
);

/**
 * Lightweight Playwright config for LLM-driven UI verification.
 *
 * Auth bypassed via pre-seeded localStorage storageState.
 * Backend/RPC/analytics routes mocked in fixtures.
 *
 * Prerequisites: `spa` needs a dev server running (bun dev / sst dev).
 * `standalone` builds and serves `dist/` itself.
 *
 * Usage:
 *   bunx playwright test --config playwright.light.config.ts
 *   bunx playwright test --config playwright.light.config.ts --project standalone
 *   bunx playwright test --config playwright.light.config.ts --ui
 */
export default defineConfig({
    testDir: "./tests-light/specs",
    testMatch: "**/*.check.ts",
    outputDir: join(__dirname, "test-results-light"),

    // Baselines are machine-specific (they carry a `-darwin` suffix) and are
    // gitignored, so a checkout without them would fail every pixel assertion
    // rather than report a regression. Opt in with LIGHT_SNAPSHOTS=1 once a
    // baseline has been generated locally; the behavioural assertions in the
    // same specs always run.
    ignoreSnapshots: !process.env.LIGHT_SNAPSHOTS,

    // `/sharing` and `/install` ship as their own bundles, so driving them
    // through the SPA would test a different build entirely.
    projects: [
        {
            name: "spa",
            testIgnore: STANDALONE_SPECS,
            use: {
                ...devices["Desktop Chrome"],
                storageState,
                baseURL: SPA_BASE_URL,
            },
        },
        {
            name: "standalone",
            testMatch: STANDALONE_SPECS,
            use: {
                ...devices["Desktop Chrome"],
                storageState,
                baseURL: STANDALONE_BASE_URL,
                // `/install` copies the code before handing it to the host, so
                // a denied write aborts the handoff a real device performs.
                permissions: ["clipboard-read", "clipboard-write"],
            },
        },
    ],
    // No `globalSetup` for the build: Playwright runs it *after* `webServer`,
    // so a fresh checkout would serve 404s until the readiness poll gave up.
    // `serve-standalone.ts` builds before it listens instead.

    webServer: {
        command: "bun tests-light/serve-standalone.ts",
        // A served route, not the bare origin: `/` is a 404 here (only
        // `/sharing` and `/install` are documents), and Playwright waits on a
        // 4xx until it times out. Passes locally only because
        // `reuseExistingServer` skips the wait.
        url: `${STANDALONE_BASE_URL}/sharing`,
        reuseExistingServer: !process.env.CI,
        // Covers a cold `build:standalone`, which now runs inside the command.
        timeout: 180_000,
        // Surfaced, not ignored: a server that fails to boot otherwise reports
        // only "Timed out waiting 120000ms".
        stdout: "pipe",
        stderr: "pipe",
    },

    use: {
        // A passing test's screenshot is never looked at, and `on` writes one
        // per test into its own directory — 35 folders of noise to find the
        // none that failed. The CI job only uploads on failure anyway.
        screenshot: "only-on-failure",
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
