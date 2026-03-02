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

    describe("isIOS", () => {
        it("should return true for iPhone user agent", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1 Instagram",
                writable: true,
                configurable: true,
            });

            const { isIOS } = await import("./inApp");
            expect(isIOS).toBe(true);
        });

        it("should return true for iPad user agent", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1",
                writable: true,
                configurable: true,
            });

            const { isIOS } = await import("./inApp");
            expect(isIOS).toBe(true);
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

            const { isIOS } = await import("./inApp");
            expect(isIOS).toBe(true);
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

            const { isIOS } = await import("./inApp");
            expect(isIOS).toBe(false);
        });

        it("should return false for Android user agent", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Instagram",
                writable: true,
                configurable: true,
            });

            const { isIOS } = await import("./inApp");
            expect(isIOS).toBe(false);
        });

        it("should return false for desktop user agent", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0",
                writable: true,
                configurable: true,
            });

            const { isIOS } = await import("./inApp");
            expect(isIOS).toBe(false);
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

    describe("redirectToExternalBrowser", () => {
        let locationHrefSpy: (v: string) => void;

        beforeEach(() => {
            locationHrefSpy = vi.fn<(v: string) => void>();
            Object.defineProperty(window, "location", {
                value: { href: "" },
                writable: true,
                configurable: true,
            });
            Object.defineProperty(window.location, "href", {
                set: locationHrefSpy,
                get: () => "https://wallet.frak.id/some/path?q=1",
                configurable: true,
            });
        });

        it("should use x-safari-https:// on iOS for https URLs", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Instagram",
                writable: true,
                configurable: true,
            });

            const { redirectToExternalBrowser } = await import("./inApp");
            redirectToExternalBrowser("https://wallet.frak.id/page?foo=bar");
            expect(locationHrefSpy).toHaveBeenCalledWith(
                "x-safari-https://wallet.frak.id/page?foo=bar"
            );
        });

        it("should use x-safari-http:// on iOS for http URLs", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Instagram",
                writable: true,
                configurable: true,
            });

            const { redirectToExternalBrowser } = await import("./inApp");
            redirectToExternalBrowser("http://localhost:3000/page");
            expect(locationHrefSpy).toHaveBeenCalledWith(
                "x-safari-http://localhost:3000/page"
            );
        });

        it("should use backend redirect on Android", async () => {
            Object.defineProperty(global.navigator, "userAgent", {
                value: "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Instagram",
                writable: true,
                configurable: true,
            });

            const { redirectToExternalBrowser } = await import("./inApp");
            redirectToExternalBrowser("https://wallet.frak.id/page");
            expect(locationHrefSpy).toHaveBeenCalledWith(
                expect.stringContaining("/common/social?u=")
            );
        });
    });
});
