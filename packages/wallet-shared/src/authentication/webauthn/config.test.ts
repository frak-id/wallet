import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("WebAuthN config", () => {
    let originalWindow: typeof globalThis.window;

    beforeEach(() => {
        originalWindow = globalThis.window;
        vi.resetModules();

        Object.defineProperty(globalThis, "window", {
            value: {
                location: {
                    hostname: "localhost",
                    protocol: "tauri:",
                },
            },
            writable: true,
            configurable: true,
        });

        vi.stubEnv("STAGE", "local");
        vi.stubEnv("WEBAUTHN_RP_ID", "");
        vi.stubEnv("FRAK_WALLET_URL", "https://wallet-dev.frak.id");
    });

    afterEach(() => {
        globalThis.window = originalWindow;
        vi.unstubAllEnvs();
        vi.resetAllMocks();
    });

    it("should keep rpOrigin compatible with rpId in Tauri", async () => {
        const { WebAuthN } = await import("@frak-labs/app-essentials");
        const originHost = new URL(WebAuthN.rpOrigin).hostname;
        const isCompatible =
            originHost === WebAuthN.rpId ||
            originHost.endsWith(`.${WebAuthN.rpId}`);

        expect(isCompatible).toBe(true);
    });
});
