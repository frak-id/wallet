#!/usr/bin/env bun
/**
 * Blocks until jsDelivr serves the exact `@frak-labs/components` version the
 * SDK pointer is about to name (`infra/sdk-pointer.ts`). Run after `npm publish`.
 */
import { readFileSync } from "node:fs";

export type WaitOptions = {
    pollIntervalMs: number;
    timeoutMs: number;
    fetch: (url: string) => Promise<{ ok: boolean; status: number } | null>;
    log: (line: string) => void;
};

const DEFAULTS: WaitOptions = {
    pollIntervalMs: 15_000,
    timeoutMs: 10 * 60 * 1000,
    fetch: (url) => fetch(url, { method: "HEAD" }).catch(() => null),
    log: console.log,
};

export function loaderUrl(version: string): string {
    return `https://cdn.jsdelivr.net/npm/@frak-labs/components@${version}/cdn/loader.js`;
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(
    url: string,
    overrides: Partial<WaitOptions> = {}
): Promise<void> {
    const options = { ...DEFAULTS, ...overrides };
    const deadline = Date.now() + options.timeoutMs;
    for (;;) {
        const response = await options.fetch(url);
        if (response?.ok) {
            options.log(`✅ jsDelivr serves ${url}`);
            return;
        }
        if (Date.now() >= deadline) {
            throw new Error(
                `jsDelivr never returned 200 for ${url} within ${options.timeoutMs / 1000}s`
            );
        }
        options.log(
            `⏳ ${url} not live yet (${response?.status ?? "no response"}), retrying`
        );
        await sleep(options.pollIntervalMs);
    }
}

if (import.meta.main) {
    const version =
        process.env.SDK_POINTER_VERSION ||
        (
            JSON.parse(
                readFileSync(
                    new URL("../sdk/components/package.json", import.meta.url),
                    "utf8"
                )
            ) as { version: string }
        ).version;
    await waitFor(loaderUrl(version));
}
