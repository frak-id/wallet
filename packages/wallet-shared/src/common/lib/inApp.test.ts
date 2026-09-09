import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PATCHED_NAVIGATOR_KEYS = ["userAgent", "maxTouchPoints"] as const;

describe("inApp utilities", () => {
    // Each case redefines `navigator.userAgent` / `maxTouchPoints` in place.
    // Capture the descriptors and restore them the same way: Vitest 5
    // propagates global assignments to the underlying jsdom window, so a plain
    // `global.navigator = ...` throws — `navigator` is getter-only there.
    let navigatorDescriptors: Record<string, PropertyDescriptor>;

    beforeEach(() => {
        navigatorDescriptors = {};
        for (const key of PATCHED_NAVIGATOR_KEYS) {
            const descriptor = Object.getOwnPropertyDescriptor(
                globalThis.navigator,
                key
            );
            if (descriptor) navigatorDescriptors[key] = descriptor;
        }
    });

    afterEach(() => {
        for (const key of PATCHED_NAVIGATOR_KEYS) {
            const descriptor = navigatorDescriptors[key];
            if (descriptor) {
                Object.defineProperty(globalThis.navigator, key, descriptor);
            }
        }
        vi.resetModules();
    });

    describe("isInIframe", () => {
        it("should be a boolean value", async () => {
            const { isInIframe } = await import("./inApp");
            expect(typeof isInIframe).toBe("boolean");
        });

        it("should check window.self vs window.top", () => {
            // In jsdom, window.self === window.top by default
            expect(window.self === window.top).toBe(true);
        });
    });

    describe("isUaIOS", () => {
        it("should return true for iPhone user agent", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1 Instagram",
                writable: true,
                configurable: true,
            });

            const { isUaIOS } = await import("./inApp");
            expect(isUaIOS).toBe(true);
        });

        it("should return true for iPad user agent", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1",
                writable: true,
                configurable: true,
            });

            const { isUaIOS } = await import("./inApp");
            expect(isUaIOS).toBe(true);
        });

        it("should return true for iPadOS 13+ (Macintosh UA with touch)", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
                writable: true,
                configurable: true,
            });
            Object.defineProperty(global.navigator, "maxTouchPoints", {
                value: 5,
                writable: true,
                configurable: true,
            });

            const { isUaIOS } = await import("./inApp");
            expect(isUaIOS).toBe(true);
        });

        it("should return false for real Mac (Macintosh UA, no touch)", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
                writable: true,
                configurable: true,
            });
            Object.defineProperty(global.navigator, "maxTouchPoints", {
                value: 0,
                writable: true,
                configurable: true,
            });

            const { isUaIOS } = await import("./inApp");
            expect(isUaIOS).toBe(false);
        });

        it("should return false for Android user agent", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Instagram",
                writable: true,
                configurable: true,
            });

            const { isUaIOS } = await import("./inApp");
            expect(isUaIOS).toBe(false);
        });

        it("should return false for desktop user agent", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0",
                writable: true,
                configurable: true,
            });

            const { isUaIOS } = await import("./inApp");
            expect(isUaIOS).toBe(false);
        });
    });

    describe("isIPad", () => {
        it("should return true for iPadOS 13+ (Macintosh UA with touch)", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
                writable: true,
                configurable: true,
            });
            Object.defineProperty(global.navigator, "maxTouchPoints", {
                value: 5,
                writable: true,
                configurable: true,
            });

            const { isIPad } = await import("./inApp");
            expect(isIPad).toBe(true);
        });

        it("should return true for pre-iPadOS 13 iPad UA", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15",
                writable: true,
                configurable: true,
            });

            const { isIPad } = await import("./inApp");
            expect(isIPad).toBe(true);
        });

        it("should return false for iPhone", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1",
                writable: true,
                configurable: true,
            });

            const { isIPad } = await import("./inApp");
            expect(isIPad).toBe(false);
        });

        it("should return false for real Mac (no touch)", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
                writable: true,
                configurable: true,
            });
            Object.defineProperty(global.navigator, "maxTouchPoints", {
                value: 0,
                writable: true,
                configurable: true,
            });

            const { isIPad } = await import("./inApp");
            expect(isIPad).toBe(false);
        });

        it("should return false for Android", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36",
                writable: true,
                configurable: true,
            });

            const { isIPad } = await import("./inApp");
            expect(isIPad).toBe(false);
        });
    });
});
