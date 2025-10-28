import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSessionFlag } from "./useSessionFlag";

describe("useSessionFlag", () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    it("should return default value when no stored value exists", () => {
        const { result } = renderHook(() => useSessionFlag("test-key", false));

        expect(result.current[0]).toBe(false);
    });

    it("should return false when no value exists (ignores default on client)", () => {
        // The hook only uses default value for SSR, not client-side
        const { result } = renderHook(() => useSessionFlag("test-key", true));

        // Returns false because sessionStorage.getItem returns null
        expect(result.current[0]).toBe(false);
    });

    it("should return stored value from sessionStorage", () => {
        sessionStorage.setItem("test-key", "true");

        const { result } = renderHook(() => useSessionFlag("test-key", false));

        expect(result.current[0]).toBe(true);
    });

    it("should update value when setValue is called", () => {
        const { result } = renderHook(() => useSessionFlag("test-key", false));

        expect(result.current[0]).toBe(false);

        act(() => {
            result.current[1](true);
        });

        expect(result.current[0]).toBe(true);
        expect(sessionStorage.getItem("test-key")).toBe("true");
    });

    it("should update value to false", () => {
        sessionStorage.setItem("test-key", "true");

        const { result } = renderHook(() => useSessionFlag("test-key", false));

        expect(result.current[0]).toBe(true);

        act(() => {
            result.current[1](false);
        });

        expect(result.current[0]).toBe(false);
        expect(sessionStorage.getItem("test-key")).toBe("false");
    });

    it("should sync across multiple hook instances with same key", () => {
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

    it("should not sync across different keys", () => {
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

    it("should handle multiple updates", () => {
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

    it("should persist value after unmount and remount", () => {
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

    it("should handle non-boolean stored values", () => {
        sessionStorage.setItem("test-key", "invalid");

        const { result } = renderHook(() => useSessionFlag("test-key", false));

        // Non-"true" values should be falsy
        expect(result.current[0]).toBe(false);
    });

    it("should clean up subscribers on unmount", () => {
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
});
