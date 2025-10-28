import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ua utilities", () => {
    let originalNavigator: typeof navigator;

    beforeEach(() => {
        originalNavigator = global.navigator;
    });

    afterEach(() => {
        global.navigator = originalNavigator;
        vi.resetModules();
    });

    it("should detect mobile device from user agent", async () => {
        Object.defineProperty(global.navigator, "userAgent", {
            value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
            writable: true,
            configurable: true,
        });

        const { ua } = await import("./ua");
        expect(ua.isMobile).toBe(true);
        expect(ua.detailed).toBeDefined();
    });

    it("should detect desktop device from user agent", async () => {
        Object.defineProperty(global.navigator, "userAgent", {
            value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0",
            writable: true,
            configurable: true,
        });

        const { ua } = await import("./ua");
        expect(ua.isMobile).toBe(false);
        expect(ua.detailed).toBeDefined();
    });

    it("should detect Android mobile device", async () => {
        Object.defineProperty(global.navigator, "userAgent", {
            value: "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 Chrome/91.0",
            writable: true,
            configurable: true,
        });

        const { ua } = await import("./ua");
        expect(ua.isMobile).toBe(true);
    });

    it("should provide detailed parser information", async () => {
        Object.defineProperty(global.navigator, "userAgent", {
            value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/605.1",
            writable: true,
            configurable: true,
        });

        const { ua } = await import("./ua");
        expect(ua.detailed?.getDevice()).toBeDefined();
        expect(ua.detailed?.getBrowser()).toBeDefined();
        expect(ua.detailed?.getOS()).toBeDefined();
    });

    it("should handle tablet as non-mobile", async () => {
        Object.defineProperty(global.navigator, "userAgent", {
            value: "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
            writable: true,
            configurable: true,
        });

        const { ua } = await import("./ua");
        // Tablets are not classified as "mobile" type in ua-parser-js
        expect(ua.isMobile).toBe(false);
    });
});
