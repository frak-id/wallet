import process from "node:process";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.GALLERY_PORT ?? 3200);
// Playwright connects to loopback; CI widens the bind with `GALLERY_HOST`
// because loopback is unreachable across a container's network namespace.
const BASE_URL = `http://127.0.0.1:${PORT}`;

const ENGINES = {
    chromium: devices["Desktop Chrome"],
    webkit: devices["Desktop Safari"],
    firefox: devices["Desktop Firefox"],
};
const isEngine = (name: string): name is keyof typeof ENGINES =>
    Object.hasOwn(ENGINES, name);
// A typo must fail the run, not quietly drop an engine.
const browsers = (process.env.GALLERY_BROWSERS ?? "chromium")
    .split(",")
    .map((name) => name.trim())
    .map((name) => {
        if (!isEngine(name))
            throw new Error(
                `GALLERY_BROWSERS: unknown engine "${name}" (use ${Object.keys(ENGINES).join(", ")})`
            );
        return name;
    });

export default defineConfig({
    testDir: "./gallery/specs",
    testMatch: "**/*.check.ts",
    outputDir: "./gallery/test-results",
    snapshotDir: "./gallery/snapshots",

    // Baselines are machine-specific (platform suffix) and gitignored, so a
    // checkout without them would fail every pixel assertion. Opt in with
    // GALLERY_SNAPSHOTS=1 once a baseline exists; behaviour checks always run.
    ignoreSnapshots: !process.env.GALLERY_SNAPSHOTS,

    projects: browsers.map((name) => ({ name, use: { ...ENGINES[name] } })),

    webServer: {
        command:
            "vite build --config gallery/vite.config.ts && vite preview --config gallery/vite.config.ts",
        url: BASE_URL,
        // A server left on the port by another worktree would be tested in place of this build.
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
    },

    use: {
        baseURL: BASE_URL,
        // Dates and number formats render differently per machine otherwise.
        locale: "en-US",
        timezoneId: "UTC",
        screenshot: "only-on-failure",
        video: "off",
        trace: "off",
        actionTimeout: 8_000,
        navigationTimeout: 15_000,
    },

    fullyParallel: true,
    retries: 0,
    reporter: [["list"], ["html", { open: "never" }]],
    forbidOnly: !!process.env.CI,
});
