import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useResponsiveValue } from "./useResponsiveValue";

/**
 * Mock `window.matchMedia` so both `(min-width: 768px)` and
 * `(min-width: 1024px)` resolve against a single simulated viewport width.
 */
function setViewportWidth(width: number) {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: vi.fn((query: string) => {
            const match = query.match(/min-width:\s*(\d+)px/);
            const min = match ? Number(match[1]) : 0;
            return {
                matches: width >= min,
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                onchange: null,
            } as unknown as MediaQueryList;
        }),
    });
}

describe("useResponsiveValue", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the mobile value below the tablet breakpoint", () => {
        setViewportWidth(500);
        const { result } = renderHook(() =>
            useResponsiveValue({ mobile: "m", tablet: "t", desktop: "d" })
        );
        expect(result.current).toBe("m");
    });

    it("returns the tablet value between tablet and desktop", () => {
        setViewportWidth(800);
        const { result } = renderHook(() =>
            useResponsiveValue({ mobile: "m", tablet: "t", desktop: "d" })
        );
        expect(result.current).toBe("t");
    });

    it("returns the desktop value at and above the desktop breakpoint", () => {
        setViewportWidth(1200);
        const { result } = renderHook(() =>
            useResponsiveValue({ mobile: "m", tablet: "t", desktop: "d" })
        );
        expect(result.current).toBe("d");
    });

    it("carries the tablet value forward to desktop when desktop is undefined", () => {
        setViewportWidth(1200);
        const { result } = renderHook(() =>
            useResponsiveValue({ mobile: "m", tablet: "t" })
        );
        expect(result.current).toBe("t");
    });

    it("carries the mobile value forward when tablet/desktop are undefined", () => {
        setViewportWidth(1200);
        const { result } = renderHook(() =>
            useResponsiveValue({ mobile: "m" })
        );
        expect(result.current).toBe("m");
    });

    it("supports boolean values for runtime branching", () => {
        setViewportWidth(500);
        const { result } = renderHook(() =>
            useResponsiveValue({ mobile: true, tablet: false })
        );
        expect(result.current).toBe(true);
    });
});
