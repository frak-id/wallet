import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const configPerEnv = {
    dev: {
        baseURL: "https://wallet-dev.frak.id",
    },
    prod: {
        baseURL: "https://wallet.frak.id",
    },
    local: {
        baseURL: "https://localhost:3000",
    },
};
const targetEnv = (process.env.TARGET_ENV ??
    "dev") as keyof typeof configPerEnv;

const config = configPerEnv[targetEnv];

const __dirname = dirname(fileURLToPath(import.meta.url));
const storagePath = join(__dirname, "playwright", ".storage");
export const ON_DEVICE_STORAGE_STATE = join(
    storagePath,
    `on-device-state-${targetEnv}.json`
);
export const PAIRED_STORAGE_STATE = join(
    storagePath,
    `paired-state-${targetEnv}.json`
);
export const AUTHENTICATOR_STATE = join(
    storagePath,
    `authenticator-${targetEnv}.json`
);

export default defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "html",
    use: {
        baseURL: config.baseURL,
        // Retain a full trace (network + console) on failure even without
        // retries, so setup/auth failures are diagnosable from the report.
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "setup",
            use: { ...devices["Desktop Chrome"] },
            testMatch: /global\.setup\.ts/,
        },
        {
            // Separate setup for the cross-device pairing state so its more
            // fragile flow only gates the paired suite.
            name: "setup-paired",
            use: { ...devices["Desktop Chrome"] },
            testMatch: /global-paired\.setup\.ts/,
        },
        {
            name: "chromium-on-device",
            use: {
                ...devices["Desktop Chrome"],
                storageState: ON_DEVICE_STORAGE_STATE,
                permissions: ["clipboard-read"],
            },
            dependencies: ["setup"],
            testMatch: ["**/*on-device*.spec.ts", "**/*all*.spec.ts"],
        },
        {
            name: "chromium-paired",
            use: {
                ...devices["Desktop Chrome"],
                storageState: PAIRED_STORAGE_STATE,
                permissions: ["clipboard-read"],
            },
            dependencies: ["setup-paired"],
            testMatch: ["**/*pairing*.spec.ts", "**/*all*.spec.ts"],
        },
        {
            // Logged-out context (no storageState) for flows that must start
            // unauthenticated — e.g. the modal login step. Self-contained: the
            // specs mock WebAuthn + `/auth/login`, so no `setup` dependency.
            name: "chromium-fresh",
            use: {
                ...devices["Desktop Chrome"],
                permissions: ["clipboard-read"],
            },
            testMatch: ["**/*fresh*.spec.ts"],
        },
    ],
    // We don't use the `webserver` since we rely on the sst multiplexer here
});
