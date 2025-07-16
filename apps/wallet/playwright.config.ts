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
export const STORAGE_STATE = join(storagePath, `state-${targetEnv}.json`);
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
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "setup",
            use: { ...devices["Desktop Chrome"] },
            testMatch: /global\.setup\.ts/,
        },
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                storageState: STORAGE_STATE,
                permissions: ["clipboard-read"],
            },
            dependencies: ["setup"],
        },
    ],
    // We don't use the `webserver` since we rely on the sst multiplexer here
});
