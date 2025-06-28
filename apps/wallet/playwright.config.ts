import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const configPerEnv = {
    dev: {
        baseURL: "https://wallet-dev.frak.id",
    },
    prod: {
        baseURL: "https://wallet.frak.id",
    },
    local: {
        baseURL: "http://127.0.0.1:3000",
    },
};
const targetEnv = (process.env.TARGET_ENV ??
    "local") as keyof typeof configPerEnv;

const config = configPerEnv[targetEnv];

export const STORAGE_STATE = path
    .join(
        path.dirname(import.meta.url),
        `./playwright/.storage/state-${targetEnv}.json`
    )
    .replace("file:", "");
export const AUTHENTICATOR_STATE = path
    .join(
        path.dirname(import.meta.url),
        `./playwright/.storage/authenticator-${targetEnv}.json`
    )
    .replace("file:", "");

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
            use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
            dependencies: ["setup"],
        },
    ],
    // We don't use the `webserver` since we rely on the sst multiplexer here
});
