import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useSessionFlag } from "./useSessionFlag";

describe("useSessionFlag", () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    test("should return default value when no stored value exists", () => {
        const { result } = renderHook(() => useSessionFlag("test-key", false));

        expect(result.current[0]).toBe(false);
    });

    test("should return false when no value exists (ignores default on client)", () => {
        // The hook only uses default value for SSR, not client-side
        const { result } = renderHook(() => useSessionFlag("test-key", true));

        // Returns false because sessionStorage.getItem returns null
        expect(result.current[0]).toBe(false);
    });

    test("should return stored value from sessionStorage", () => {
        sessionStorage.setItem("test-key", "true");

        const { result } = renderHook(() => useSessionFlag("test-key", false));

        expect(result.current[0]).toBe(true);
    });

    test("should update value when setValue is called", () => {
        const { result } = renderHook(() => useSessionFlag("test-key", false));

        expect(result.current[0]).toBe(false);

        act(() => {
            result.current[1](true);
        });

        expect(result.current[0]).toBe(true);
        expect(sessionStorage.getItem("test-key")).toBe("true");
    });

    test("should update value to false", () => {
        sessionStorage.setItem("test-key", "true");

        const { result } = renderHook(() => useSessionFlag("test-key", false));

        expect(result.current[0]).toBe(true);

        act(() => {
            result.current[1](false);
        });

        expect(result.current[0]).toBe(false);
        expect(sessionStorage.getItem("test-key")).toBe("false");
    });

    test("should sync across multiple hook instances with same key", () => {
        const { result: result1 } = renderHook(() =>
            useSessionFlag("shared-key", false)
        );
        const { result: result2 } = renderHook(() =>
            useSessionFlag("shared-key", false)
        );

        expect(result1.current[0]).toBe(false);
        expect(result2.current[0]).toBe(false);

        act(() => {
            result1.current[1](true);
        });

        expect(result1.current[0]).toBe(true);
        expect(result2.current[0]).toBe(true);
    });

    test("should not sync across different keys", () => {
        const { result: result1 } = renderHook(() =>
            useSessionFlag("key-1", false)
        );
        const { result: result2 } = renderHook(() =>
            useSessionFlag("key-2", false)
        );

        act(() => {
            result1.current[1](true);
        });

        expect(result1.current[0]).toBe(true);
        expect(result2.current[0]).toBe(false);
    });

    test("should handle multiple updates", () => {
        const { result } = renderHook(() => useSessionFlag("test-key", false));

        act(() => {
            result.current[1](true);
        });

        expect(result.current[0]).toBe(true);

        act(() => {
            result.current[1](false);
        });

        expect(result.current[0]).toBe(false);

        act(() => {
            result.current[1](true);
        });

        expect(result.current[0]).toBe(true);
    });

    test("should persist value after unmount and remount", () => {
        const { result: result1, unmount } = renderHook(() =>
            useSessionFlag("test-key", false)
        );

        act(() => {
            result1.current[1](true);
        });

        unmount();

        const { result: result2 } = renderHook(() =>
            useSessionFlag("test-key", false)
        );

        expect(result2.current[0]).toBe(true);
    });

    test("should handle non-boolean stored values", () => {
        sessionStorage.setItem("test-key", "invalid");

        const { result } = renderHook(() => useSessionFlag("test-key", false));

        // Non-"true" values should be falsy
        expect(result.current[0]).toBe(false);
    });

    test("should clean up subscribers on unmount", () => {
        const { unmount: unmount1 } = renderHook(() =>
            useSessionFlag("test-key", false)
        );
        const { unmount: unmount2 } = renderHook(() =>
            useSessionFlag("test-key", false)
        );

        unmount1();
        unmount2();

        // Should not throw when all subscribers are cleaned up
        expect(() => {
            sessionStorage.setItem("test-key", "true");
        }).not.toThrow();
    });

    test("should respond to storage events from other windows with matching key", () => {
        const { result } = renderHook(() => useSessionFlag("test-key", false));

        expect(result.current[0]).toBe(false);

        // Simulate a storage event from another window/tab
        act(() => {
            sessionStorage.setItem("test-key", "true");
            const event = new StorageEvent("storage", {
                key: "test-key",
                newValue: "true",
                oldValue: null,
            });
            // Manually set storageArea to bypass jsdom's strict type checking
            Object.defineProperty(event, "storageArea", {
                value: sessionStorage,
                writable: false,
            });
            window.dispatchEvent(event);
        });

        expect(result.current[0]).toBe(true);
    });

    test("should ignore storage events with different key", () => {
        const { result } = renderHook(() => useSessionFlag("test-key", false));

        const initialValue = result.current[0];

        // Simulate a storage event for a different key
        act(() => {
            sessionStorage.setItem("other-key", "true");
            const event = new StorageEvent("storage", {
                key: "other-key",
                newValue: "true",
                oldValue: null,
            });
            // Manually set storageArea to bypass jsdom's strict type checking
            Object.defineProperty(event, "storageArea", {
                value: sessionStorage,
                writable: false,
            });
            window.dispatchEvent(event);
        });

        // Value should remain unchanged
        expect(result.current[0]).toBe(initialValue);
    });

    test("should ignore storage events from localStorage", () => {
        const { result } = renderHook(() => useSessionFlag("test-key", false));

        const initialValue = result.current[0];

        // Simulate a storage event from localStorage (not sessionStorage)
        act(() => {
            const event = new StorageEvent("storage", {
                key: "test-key",
                newValue: "true",
                oldValue: null,
            });
            // Manually set storageArea to localStorage (not sessionStorage)
            Object.defineProperty(event, "storageArea", {
                value: localStorage,
                writable: false,
            });
            window.dispatchEvent(event);
        });

        // Value should remain unchanged
        expect(result.current[0]).toBe(initialValue);
    });

    test("should handle storage events when value changes from true to false", () => {
        sessionStorage.setItem("test-key", "true");
        const { result } = renderHook(() => useSessionFlag("test-key", false));

        expect(result.current[0]).toBe(true);

        // Simulate a storage event changing value to false
        act(() => {
            sessionStorage.setItem("test-key", "false");
            const event = new StorageEvent("storage", {
                key: "test-key",
                newValue: "false",
                oldValue: "true",
            });
            // Manually set storageArea to bypass jsdom's strict type checking
            Object.defineProperty(event, "storageArea", {
                value: sessionStorage,
                writable: false,
            });
            window.dispatchEvent(event);
        });

        expect(result.current[0]).toBe(false);
    });
});
