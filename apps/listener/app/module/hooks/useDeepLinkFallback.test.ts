import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { useDeepLinkFallback } from "./useDeepLinkFallback";

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
            })
        );

        expect(onFallback).toHaveBeenCalledTimes(1);

        // Second event should not trigger callback (cleared)
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { clientLifecycle: "deep-link-failed" },
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
            })
        );

        expect(onFallback).not.toHaveBeenCalled();

        // Send message without clientLifecycle
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { someOtherField: "value" },
            })
        );

        expect(onFallback).not.toHaveBeenCalled();
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
});
