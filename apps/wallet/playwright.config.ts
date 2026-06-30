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
    // One local retry (CI gets 2): the embedded-wallet modal-open race flakes
    // ~every run otherwise. This masks that single known flake, not real
    // regressions — the proper fix is stabilizing the modal-open itself.
    retries: process.env.CI ? 2 : 1,
    workers: process.env.CI ? 1 : undefined,
    reporter: "html",
    // Real-backend auth/pairing flows can run long locally; 30s default is tight.
    timeout: 60_000,
    use: {
        baseURL: config.baseURL,
        // Pin the wallet app locale for deterministic text. (The SDK listener
        // modal's language is merchant/SDK-config-driven, not browser locale.)
        locale: "en-US",
        // Retain a full trace (network + console) on failure even without
        // retries, so setup/auth failures are diagnosable from the report.
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        // On-device wallet specs run on a mobile Chromium device (the app is
        // mobile-first). Pairing (desktop-initiated cross-device) and SDK
        // (desktop partner page) specs run on Desktop Chrome. testIgnore keeps
        // sdk off the mobile project.
        {
            name: "setup",
            use: { ...devices["Pixel 7"] },
            testMatch: /global\.setup\.ts/,
        },
        {
            // Separate setup for the cross-device pairing state so its more
            // fragile flow only gates the paired suite. Desktop: pairing is a
            // desktop-initiated cross-device flow.
            name: "setup-paired",
            use: { ...devices["Desktop Chrome"] },
            testMatch: /global-paired\.setup\.ts/,
        },
        {
            name: "chromium-on-device",
            use: {
                ...devices["Pixel 7"],
                storageState: ON_DEVICE_STORAGE_STATE,
                permissions: ["clipboard-read", "clipboard-write"],
            },
            dependencies: ["setup"],
            testMatch: ["**/*on-device*.spec.ts", "**/*all*.spec.ts"],
            testIgnore: ["**/sdk/**"],
        },
        {
            name: "chromium-paired",
            use: {
                ...devices["Desktop Chrome"],
                storageState: PAIRED_STORAGE_STATE,
                permissions: ["clipboard-read", "clipboard-write"],
            },
            dependencies: ["setup-paired"],
            testMatch: ["**/*pairing*.spec.ts", "**/*all*.spec.ts"],
            testIgnore: ["**/sdk/**"],
        },
        {
            // Authenticated SDK/modal specs — desktop partner page.
            name: "sdk-embedded",
            use: {
                ...devices["Desktop Chrome"],
                storageState: ON_DEVICE_STORAGE_STATE,
                permissions: ["clipboard-read", "clipboard-write"],
            },
            dependencies: ["setup"],
            testMatch: ["**/sdk/all.spec.ts", "**/sdk/balance-all.spec.ts"],
        },
        {
            // Logged-out SDK specs (self-contained: mock WebAuthn + /auth/login,
            // so no `setup` dependency) — desktop partner page.
            name: "sdk-fresh",
            use: {
                ...devices["Desktop Chrome"],
                permissions: ["clipboard-read", "clipboard-write"],
            },
            testMatch: ["**/sdk/*fresh*.spec.ts"],
        },
    ],
    // We don't use the `webserver` since we rely on the sst multiplexer here
});
