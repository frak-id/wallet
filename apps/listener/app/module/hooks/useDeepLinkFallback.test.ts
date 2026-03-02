import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { useDeepLinkFallback } from "./useDeepLinkFallback";

const EXPECTED_ORIGIN = "https://example.com";

// Note: useDeepLinkFallback no longer imports from @frak-labs/core-sdk
// (deep link conversion is handled by the parent SDK)

// Mock emitLifecycleEvent from wallet-shared
vi.mock("@frak-labs/wallet-shared", async () => {
    const actual = await vi.importActual<
        typeof import("@frak-labs/wallet-shared")
    >("@frak-labs/wallet-shared");
    return {
        ...actual,
        emitLifecycleEvent: vi.fn(),
    };
});

// Mock resolvingContextStore to return a known origin
vi.mock("@/module/stores/resolvingContextStore", () => ({
    resolvingContextStore: {
        getState: () => ({
            context: { origin: EXPECTED_ORIGIN },
        }),
    },
}));

describe("useDeepLinkFallback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should emit redirect event when emitRedirectWithFallback called", async () => {
        const { emitLifecycleEvent } = await import("@frak-labs/wallet-shared");
        const { result } = renderHook(() => useDeepLinkFallback());

        const deepLinkUrl = "frakwallet://pair?id=test123&mode=embedded";
        const onFallback = vi.fn();

        result.current.emitRedirectWithFallback(deepLinkUrl, onFallback);

        expect(emitLifecycleEvent).toHaveBeenCalledWith({
            iframeLifecycle: "redirect",
            data: { baseRedirectUrl: deepLinkUrl },
        });
    });

    test("should store fallback callback", () => {
        const { result } = renderHook(() => useDeepLinkFallback());

        const onFallback = vi.fn();
        result.current.emitRedirectWithFallback(
            "frakwallet://test",
            onFallback
        );

        // Callback should be stored (we'll verify by triggering the event)
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { clientLifecycle: "deep-link-failed" },
                origin: EXPECTED_ORIGIN,
            })
        );

        expect(onFallback).toHaveBeenCalledTimes(1);
    });

    test("should execute callback when deep-link-failed message received", () => {
        const { result } = renderHook(() => useDeepLinkFallback());

        const onFallback = vi.fn();
        result.current.emitRedirectWithFallback(
            "frakwallet://test",
            onFallback
        );

        window.dispatchEvent(
            new MessageEvent("message", {
                data: { clientLifecycle: "deep-link-failed" },
                origin: EXPECTED_ORIGIN,
            })
        );

        expect(onFallback).toHaveBeenCalledTimes(1);
    });

    test("should clear callback after execution", () => {
        const { result } = renderHook(() => useDeepLinkFallback());

        const onFallback = vi.fn();
        result.current.emitRedirectWithFallback(
            "frakwallet://test",
            onFallback
        );

        // First event triggers callback
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { clientLifecycle: "deep-link-failed" },
                origin: EXPECTED_ORIGIN,
            })
        );

        expect(onFallback).toHaveBeenCalledTimes(1);

        // Second event should not trigger callback (cleared)
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { clientLifecycle: "deep-link-failed" },
                origin: EXPECTED_ORIGIN,
            })
        );

        expect(onFallback).toHaveBeenCalledTimes(1);
    });

    test("should add message listener on mount", () => {
        const addEventListenerSpy = vi.spyOn(window, "addEventListener");

        renderHook(() => useDeepLinkFallback());

        expect(addEventListenerSpy).toHaveBeenCalledWith(
            "message",
            expect.any(Function)
        );
    });

    test("should remove message listener on unmount", () => {
        const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

        const { unmount } = renderHook(() => useDeepLinkFallback());

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith(
            "message",
            expect.any(Function)
        );
    });

    test("should ignore non-deep-link-failed messages", () => {
        const { result } = renderHook(() => useDeepLinkFallback());

        const onFallback = vi.fn();
        result.current.emitRedirectWithFallback(
            "frakwallet://test",
            onFallback
        );

        // Send unrelated message
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { clientLifecycle: "some-other-event" },
                origin: EXPECTED_ORIGIN,
            })
        );

        expect(onFallback).not.toHaveBeenCalled();

        // Send message without clientLifecycle
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { someOtherField: "value" },
                origin: EXPECTED_ORIGIN,
            })
        );

        expect(onFallback).not.toHaveBeenCalled();
    });

    test("should ignore deep-link-failed messages from unexpected origins", () => {
        const { result } = renderHook(() => useDeepLinkFallback());

        const onFallback = vi.fn();
        result.current.emitRedirectWithFallback(
            "frakwallet://test",
            onFallback
        );

        // Send deep-link-failed from a different origin
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { clientLifecycle: "deep-link-failed" },
                origin: "https://malicious.com",
            })
        );

        expect(onFallback).not.toHaveBeenCalled();

        // Confirm that the same message from the expected origin still works
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { clientLifecycle: "deep-link-failed" },
                origin: EXPECTED_ORIGIN,
            })
        );

        expect(onFallback).toHaveBeenCalledTimes(1);
    });

    test("should handle multiple callback registrations", () => {
        const { result } = renderHook(() => useDeepLinkFallback());

        const firstCallback = vi.fn();
        const secondCallback = vi.fn();

        // Register first callback
        result.current.emitRedirectWithFallback(
            "frakwallet://test1",
            firstCallback
        );

        // Register second callback (should replace first)
        result.current.emitRedirectWithFallback(
            "frakwallet://test2",
            secondCallback
        );

        // Trigger event
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { clientLifecycle: "deep-link-failed" },
                origin: EXPECTED_ORIGIN,
            })
        );

        // Only second callback should execute
        expect(firstCallback).not.toHaveBeenCalled();
        expect(secondCallback).toHaveBeenCalledTimes(1);
    });

    test("should return stable emitRedirectWithFallback function", () => {
        const { result, rerender } = renderHook(() => useDeepLinkFallback());

        const firstFunction = result.current.emitRedirectWithFallback;
        rerender();
        const secondFunction = result.current.emitRedirectWithFallback;

        expect(firstFunction).toBe(secondFunction);
    });

    test("should always route through parent SDK lifecycle event regardless of URL type", async () => {
        const { emitLifecycleEvent } = await import("@frak-labs/wallet-shared");
        const { result } = renderHook(() => useDeepLinkFallback());

        // Deep link URL
        result.current.emitRedirectWithFallback("frakwallet://wallet", vi.fn());
        expect(emitLifecycleEvent).toHaveBeenCalledWith({
            iframeLifecycle: "redirect",
            data: { baseRedirectUrl: "frakwallet://wallet" },
        });

        vi.mocked(emitLifecycleEvent).mockClear();

        // Regular URL
        result.current.emitRedirectWithFallback(
            "https://wallet.frak.id/open",
            vi.fn()
        );
        expect(emitLifecycleEvent).toHaveBeenCalledWith({
            iframeLifecycle: "redirect",
            data: { baseRedirectUrl: "https://wallet.frak.id/open" },
        });
    });
});
