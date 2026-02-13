import * as coreSdk from "@frak-labs/core-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openFrakWalletApp } from "./openInApp";

// Mock dependencies
vi.mock("@frak-labs/core-sdk", () => ({
    DEEP_LINK_SCHEME: "frakwallet://",
    trackEvent: vi.fn(),
    triggerDeepLinkWithFallback: vi.fn(),
}));

describe("openFrakWalletApp", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("with client", () => {
        beforeEach(() => {
            vi.clearAllMocks();
            window.FrakSetup = {
                config: {},
                client: { config: {} } as any,
            } as any;
        });

        it("should track open_in_app_clicked event when client exists", () => {
            openFrakWalletApp();

            expect(coreSdk.trackEvent).toHaveBeenCalledWith(
                window.FrakSetup?.client,
                "open_in_app_clicked"
            );
        });

        it("should trigger deep link with default path 'wallet'", () => {
            openFrakWalletApp();

            expect(coreSdk.triggerDeepLinkWithFallback).toHaveBeenCalledWith(
                "frakwallet://wallet",
                expect.objectContaining({
                    onFallback: expect.any(Function),
                })
            );
        });

        it("should trigger deep link with custom path", () => {
            openFrakWalletApp("pair?id=123");

            expect(coreSdk.triggerDeepLinkWithFallback).toHaveBeenCalledWith(
                "frakwallet://pair?id=123",
                expect.any(Object)
            );
        });

        it("should track app_not_installed event when onFallback is called", () => {
            // Capture the onFallback callback
            let capturedOnFallback: (() => void) | undefined;
            vi.mocked(coreSdk.triggerDeepLinkWithFallback).mockImplementation(
                (_deepLink, options) => {
                    capturedOnFallback = options?.onFallback;
                }
            );

            openFrakWalletApp();

            // Verify onFallback was captured
            expect(capturedOnFallback).toBeDefined();

            // Clear previous calls
            vi.mocked(coreSdk.trackEvent).mockClear();

            // Simulate fallback being triggered (app not installed)
            capturedOnFallback?.();

            expect(coreSdk.trackEvent).toHaveBeenCalledWith(
                window.FrakSetup?.client,
                "app_not_installed"
            );
        });
    });

    describe("without client", () => {
        it("should still work when client is undefined (only deep link triggered)", () => {
            // Temporarily clear FrakSetup
            const originalFrakSetup = window.FrakSetup;
            // @ts-expect-error - Testing undefined state
            window.FrakSetup = undefined;

            vi.clearAllMocks();

            openFrakWalletApp();

            // Deep link should still be triggered even without client
            expect(coreSdk.triggerDeepLinkWithFallback).toHaveBeenCalledWith(
                "frakwallet://wallet",
                expect.any(Object)
            );

            // Restore
            window.FrakSetup = originalFrakSetup;
        });

        it("should not crash when onFallback is called without client", () => {
            const originalFrakSetup = window.FrakSetup;
            // @ts-expect-error - Testing undefined state
            window.FrakSetup = undefined;

            vi.clearAllMocks();

            let capturedOnFallback: (() => void) | undefined;
            vi.mocked(coreSdk.triggerDeepLinkWithFallback).mockImplementation(
                (_deepLink, options) => {
                    capturedOnFallback = options?.onFallback;
                }
            );

            openFrakWalletApp();

            // Should not throw
            expect(() => capturedOnFallback?.()).not.toThrow();

            // Restore
            window.FrakSetup = originalFrakSetup;
        });
    });
});
