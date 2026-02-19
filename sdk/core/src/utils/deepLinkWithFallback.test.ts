import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
    isFrakDeepLink,
    triggerDeepLinkWithFallback,
} from "./deepLinkWithFallback";

/**
 * Set navigator.userAgent for testing platform-specific behavior
 */
function mockUserAgent(ua: string) {
    Object.defineProperty(navigator, "userAgent", {
        value: ua,
        writable: true,
        configurable: true,
    });
}

const CHROME_ANDROID_UA =
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const FIREFOX_ANDROID_UA =
    "Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0";
const DESKTOP_CHROME_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

describe("deepLinkWithFallback", () => {
    let originalHidden: boolean;
    let originalAddEventListener: typeof document.addEventListener;
    let originalRemoveEventListener: typeof document.removeEventListener;
    let originalUserAgent: string;
    let visibilityChangeHandler: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();

        // Store originals
        originalHidden = document.hidden;
        originalAddEventListener = document.addEventListener;
        originalRemoveEventListener = document.removeEventListener;
        originalUserAgent = navigator.userAgent;

        // Default to desktop Chrome (non-Android)
        mockUserAgent(DESKTOP_CHROME_UA);

        // Mock document.hidden
        Object.defineProperty(document, "hidden", {
            value: false,
            writable: true,
            configurable: true,
        });

        // Mock window.location
        Object.defineProperty(window, "location", {
            value: { href: "https://test.com" },
            writable: true,
            configurable: true,
        });

        // Capture visibilitychange handler
        visibilityChangeHandler = null;
        document.addEventListener = vi.fn(
            (event: string, handler: EventListener) => {
                if (event === "visibilitychange") {
                    visibilityChangeHandler = handler as () => void;
                }
            }
        );
        document.removeEventListener = vi.fn();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();

        // Restore originals
        Object.defineProperty(document, "hidden", {
            value: originalHidden,
            writable: true,
            configurable: true,
        });
        document.addEventListener = originalAddEventListener;
        document.removeEventListener = originalRemoveEventListener;
        mockUserAgent(originalUserAgent);
    });

    describe("triggerDeepLinkWithFallback", () => {
        test("should trigger deep link immediately", () => {
            triggerDeepLinkWithFallback("frakwallet://wallet");

            expect(window.location.href).toBe("frakwallet://wallet");
        });

        test("should add visibilitychange listener", () => {
            triggerDeepLinkWithFallback("frakwallet://wallet");

            expect(document.addEventListener).toHaveBeenCalledWith(
                "visibilitychange",
                expect.any(Function)
            );
        });

        test("should trigger fallback callback when page stays visible after timeout", () => {
            const onFallback = vi.fn();

            triggerDeepLinkWithFallback("frakwallet://wallet", { onFallback });

            // Document stays visible (app not installed)
            Object.defineProperty(document, "hidden", {
                value: false,
                configurable: true,
            });

            // Advance past timeout
            vi.advanceTimersByTime(2500);

            expect(onFallback).toHaveBeenCalledTimes(1);
        });

        test("should NOT trigger fallback when page goes hidden (app opened)", () => {
            const onFallback = vi.fn();

            triggerDeepLinkWithFallback("frakwallet://wallet", { onFallback });

            // Simulate app opening (page goes to background)
            Object.defineProperty(document, "hidden", {
                value: true,
                configurable: true,
            });
            visibilityChangeHandler?.();

            // Advance past timeout
            vi.advanceTimersByTime(2500);

            // Fallback should NOT be triggered
            expect(onFallback).not.toHaveBeenCalled();
            // Location should still be the deep link
            expect(window.location.href).toBe("frakwallet://wallet");
        });

        test("should respect custom timeout", () => {
            const onFallback = vi.fn();

            triggerDeepLinkWithFallback("frakwallet://wallet", {
                timeout: 1000,
                onFallback,
            });

            // Advance to just before custom timeout
            vi.advanceTimersByTime(999);
            expect(onFallback).not.toHaveBeenCalled();

            // Advance past custom timeout
            vi.advanceTimersByTime(1);
            expect(onFallback).toHaveBeenCalledTimes(1);
        });

        test("should remove event listener after timeout", () => {
            triggerDeepLinkWithFallback("frakwallet://wallet");

            // Advance past timeout
            vi.advanceTimersByTime(2500);

            expect(document.removeEventListener).toHaveBeenCalledWith(
                "visibilitychange",
                expect.any(Function)
            );
        });

        test("should work without onFallback callback", () => {
            // Should not throw
            triggerDeepLinkWithFallback("frakwallet://wallet");

            // Advance past timeout
            vi.advanceTimersByTime(2500);

            // No error should occur, callback is optional
        });

        describe("Android Intent URL conversion", () => {
            test("should use intent:// URL on Chromium Android", () => {
                mockUserAgent(CHROME_ANDROID_UA);

                triggerDeepLinkWithFallback("frakwallet://wallet");

                expect(window.location.href).toBe(
                    "intent://wallet#Intent;scheme=frakwallet;end"
                );
            });

            test("should preserve path and query params in intent URL", () => {
                mockUserAgent(CHROME_ANDROID_UA);

                triggerDeepLinkWithFallback(
                    "frakwallet://pair?id=abc-123&mode=embedded"
                );

                expect(window.location.href).toBe(
                    "intent://pair?id=abc-123&mode=embedded#Intent;scheme=frakwallet;end"
                );
            });

            test("should use custom scheme on Firefox Android", () => {
                mockUserAgent(FIREFOX_ANDROID_UA);

                triggerDeepLinkWithFallback("frakwallet://wallet");

                expect(window.location.href).toBe("frakwallet://wallet");
            });

            test("should use custom scheme on desktop Chrome", () => {
                mockUserAgent(DESKTOP_CHROME_UA);

                triggerDeepLinkWithFallback("frakwallet://wallet");

                expect(window.location.href).toBe("frakwallet://wallet");
            });

            test("should not convert non-frak deep links to intent URL", () => {
                mockUserAgent(CHROME_ANDROID_UA);

                triggerDeepLinkWithFallback("https://wallet.frak.id/pair");

                expect(window.location.href).toBe(
                    "https://wallet.frak.id/pair"
                );
            });
        });
    });

    describe("isFrakDeepLink", () => {
        test("should return true for frakwallet:// URLs", () => {
            expect(isFrakDeepLink("frakwallet://wallet")).toBe(true);
            expect(isFrakDeepLink("frakwallet://pair?id=123")).toBe(true);
            expect(isFrakDeepLink("frakwallet://")).toBe(true);
        });

        test("should return false for non-frakwallet URLs", () => {
            expect(isFrakDeepLink("https://wallet.frak.id")).toBe(false);
            expect(isFrakDeepLink("http://example.com")).toBe(false);
            expect(isFrakDeepLink("myapp://something")).toBe(false);
            expect(isFrakDeepLink("")).toBe(false);
        });
    });
});
