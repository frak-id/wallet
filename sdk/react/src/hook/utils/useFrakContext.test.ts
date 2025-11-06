/**
 * Tests for useFrakContext hook
 * Tests hook that extracts and manages Frak context from URL
 */

import { vi } from "vitest";

vi.mock("@frak-labs/core-sdk", async () => {
    const actual = await vi.importActual<typeof import("@frak-labs/core-sdk")>(
        "@frak-labs/core-sdk"
    );
    return {
        ...actual,
        FrakContextManager: {
            parse: vi.fn(),
            replaceUrl: vi.fn(),
        },
    };
});

vi.mock("./useWindowLocation");

import type { FrakContext } from "@frak-labs/core-sdk";
import { FrakContextManager } from "@frak-labs/core-sdk";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useFrakContext } from "./useFrakContext";
import { useWindowLocation } from "./useWindowLocation";

describe("useFrakContext", () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        consoleLogSpy.mockClear();
    });

    test("should return null when no location href", () => {
        vi.mocked(useWindowLocation).mockReturnValue({
            location: undefined,
            href: undefined,
        });

        const { result } = renderHook(() => useFrakContext());

        expect(result.current.frakContext).toBeNull();
    });

    test("should parse frak context from URL", () => {
        const mockContext: FrakContext = {
            r: "0x1234567890123456789012345678901234567890",
        };

        vi.mocked(useWindowLocation).mockReturnValue({
            location: { href: "https://example.com?frak=test" } as Location,
            href: "https://example.com?frak=test",
        });

        vi.mocked(FrakContextManager.parse).mockReturnValue(mockContext);

        const { result } = renderHook(() => useFrakContext());

        expect(FrakContextManager.parse).toHaveBeenCalledWith({
            url: "https://example.com?frak=test",
        });
        expect(result.current.frakContext).toEqual(mockContext);
    });

    test("should update context with new values", () => {
        vi.mocked(useWindowLocation).mockReturnValue({
            location: { href: "https://example.com" } as Location,
            href: "https://example.com",
        });

        vi.mocked(FrakContextManager.parse).mockReturnValue(null);

        const { result } = renderHook(() => useFrakContext());

        const newContext: Partial<FrakContext> = {
            r: "0x4567890123456789012345678901234567890123",
        };

        result.current.updateContext(newContext);

        expect(console.log).toHaveBeenCalledWith("Updating context", {
            newContext,
        });
        expect(FrakContextManager.replaceUrl).toHaveBeenCalledWith({
            url: "https://example.com",
            context: newContext,
        });
    });

    test("should memoize frak context based on href", () => {
        const mockContext: FrakContext = {
            r: "0x7890123456789012345678901234567890123456",
        };

        vi.mocked(useWindowLocation).mockReturnValue({
            location: { href: "https://example.com?test=1" } as Location,
            href: "https://example.com?test=1",
        });

        vi.mocked(FrakContextManager.parse).mockReturnValue(mockContext);

        const { result, rerender } = renderHook(() => useFrakContext());

        const firstContext = result.current.frakContext;

        // Rerender without changing href
        rerender();

        expect(result.current.frakContext).toBe(firstContext);
        expect(FrakContextManager.parse).toHaveBeenCalledTimes(1);
    });

    test("should reparse context when href changes", () => {
        const mockContext1: FrakContext = {
            r: "0x1111111111111111111111111111111111111111",
        };
        const mockContext2: FrakContext = {
            r: "0x2222222222222222222222222222222222222222",
        };

        const { rerender } = renderHook(() => useFrakContext());

        vi.mocked(useWindowLocation).mockReturnValue({
            location: { href: "https://example.com?v=1" } as Location,
            href: "https://example.com?v=1",
        });

        vi.mocked(FrakContextManager.parse).mockReturnValue(mockContext1);

        rerender();

        expect(FrakContextManager.parse).toHaveBeenCalledWith({
            url: "https://example.com?v=1",
        });

        // Change href
        vi.mocked(useWindowLocation).mockReturnValue({
            location: { href: "https://example.com?v=2" } as Location,
            href: "https://example.com?v=2",
        });

        vi.mocked(FrakContextManager.parse).mockReturnValue(mockContext2);

        rerender();

        expect(FrakContextManager.parse).toHaveBeenCalledWith({
            url: "https://example.com?v=2",
        });
    });
});
