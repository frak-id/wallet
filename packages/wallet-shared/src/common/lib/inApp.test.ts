import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("inApp utilities", () => {
    let originalWindow: typeof window;
    let originalNavigator: typeof navigator;

    beforeEach(() => {
        originalWindow = global.window;
        originalNavigator = global.navigator;
    });

    afterEach(() => {
        global.window = originalWindow;
        global.navigator = originalNavigator;
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

    describe("isInAppBrowser", () => {
        it("should return true for Instagram browser", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Instagram",
                writable: true,
                configurable: true,
            });

            const { isInAppBrowser } = await import("./inApp");
            expect(isInAppBrowser).toBe(true);
        });

        it("should return true for Facebook browser (fban)", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) FBAN",
                writable: true,
                configurable: true,
            });

            const { isInAppBrowser } = await import("./inApp");
            expect(isInAppBrowser).toBe(true);
        });

        it("should return true for Facebook browser (fbav)", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) FBAV",
                writable: true,
                configurable: true,
            });

            const { isInAppBrowser } = await import("./inApp");
            expect(isInAppBrowser).toBe(true);
        });

        it("should return true for Facebook browser (facebook)", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Windows NT 10.0) facebook AppleWebKit/537.36",
                writable: true,
                configurable: true,
            });

            const { isInAppBrowser } = await import("./inApp");
            expect(isInAppBrowser).toBe(true);
        });

        it("should return false for regular Chrome browser", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0",
                writable: true,
                configurable: true,
            });

            const { isInAppBrowser } = await import("./inApp");
            expect(isInAppBrowser).toBe(false);
        });

        it("should return false for Safari browser", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1",
                writable: true,
                configurable: true,
            });

            const { isInAppBrowser } = await import("./inApp");
            expect(isInAppBrowser).toBe(false);
        });

        it("should handle case-insensitive user agent strings", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Linux; Android 10) INSTAGRAM AppleWebKit/537.36",
                writable: true,
                configurable: true,
            });

            const { isInAppBrowser } = await import("./inApp");
            expect(isInAppBrowser).toBe(true);
        });
    });

    describe("inAppRedirectUrl", () => {
        it("should use BACKEND_URL environment variable", async () => {
            const { inAppRedirectUrl } = await import("./inApp");
            expect(inAppRedirectUrl).toContain("/common/social?u=");
            expect(inAppRedirectUrl).toBe(
                `${process.env.BACKEND_URL}/common/social?u=`
            );
        });
    });
});
