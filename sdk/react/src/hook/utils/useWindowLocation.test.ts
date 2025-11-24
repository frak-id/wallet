/**
 * Tests for useWindowLocation hook
 * Tests hook that tracks window.location changes
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useWindowLocation } from "./useWindowLocation";

describe("useWindowLocation", () => {
    test("should return current window location", () => {
        const { result } = renderHook(() => useWindowLocation());

        expect(result.current.location).toBeDefined();
        expect(result.current.href).toBeDefined();
        expect(typeof result.current.href).toBe("string");
    });

    test("should derive href from location", () => {
        const { result } = renderHook(() => useWindowLocation());

        if (result.current.location) {
            expect(result.current.href).toBe(result.current.location.href);
        }
    });

    test("should register popstate listener", () => {
        const addEventListenerSpy = vi.spyOn(window, "addEventListener");

        renderHook(() => useWindowLocation());

        expect(addEventListenerSpy).toHaveBeenCalledWith(
            "popstate",
            expect.any(Function)
        );

        addEventListenerSpy.mockRestore();
    });

    test("should cleanup popstate listener on unmount", () => {
        const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

        const { unmount } = renderHook(() => useWindowLocation());

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith(
            "popstate",
            expect.any(Function)
        );

        removeEventListenerSpy.mockRestore();
    });
});
