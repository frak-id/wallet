import { FrakContextManager } from "@frak-labs/core-sdk";
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFrakContext } from "./useFrakContext";
import { useWindowLocation } from "./useWindowLocation";

// Mock dependencies
vi.mock("./useWindowLocation", () => ({
    useWindowLocation: vi.fn(),
}));

// Mock FrakContextManager
vi.mock("@frak-labs/core-sdk", () => {
    const FrakContextManager = {
        parse: vi.fn(),
        replaceUrl: vi.fn(),
    };
    return { FrakContextManager };
});

describe("useFrakContext", () => {
    // Spy on console.log
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Setup type for mocked functions
    type MockFn<TReturn = unknown> = {
        mockReturnValue: (value: TReturn) => void;
        mockImplementation: (impl: (...args: unknown[]) => TReturn) => void;
    };

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Default mock implementation for useWindowLocation
        (useWindowLocation as unknown as MockFn).mockReturnValue({
            location: { href: "https://example.com?r=test-referrer" },
            href: "https://example.com?r=test-referrer",
        });

        // Default mock implementation for FrakContextManager.parse
        (FrakContextManager.parse as MockFn).mockReturnValue({
            r: "test-referrer",
        });
    });

    it("should return null context when no location is available", () => {
        // Mock location as undefined
        (useWindowLocation as unknown as MockFn).mockReturnValue({
            location: undefined,
            href: undefined,
        });

        const { result } = renderHook(() => useFrakContext());

        expect(result.current.frakContext).toBeNull();
        expect(FrakContextManager.parse).not.toHaveBeenCalled();
    });

    it("should return null context when href is undefined", () => {
        // Mock href as undefined but location as defined
        (useWindowLocation as unknown as MockFn).mockReturnValue({
            location: {},
            href: undefined,
        });

        const { result } = renderHook(() => useFrakContext());

        expect(result.current.frakContext).toBeNull();
        expect(FrakContextManager.parse).not.toHaveBeenCalled();
    });

    it("should parse context from URL when location is available", () => {
        const mockUrl = "https://example.com?r=test-referrer";
        const mockContext = { r: "test-referrer" };

        // Setup mocks
        (useWindowLocation as unknown as MockFn).mockReturnValue({
            location: { href: mockUrl },
            href: mockUrl,
        });
        (FrakContextManager.parse as MockFn).mockReturnValue(mockContext);

        const { result } = renderHook(() => useFrakContext());

        expect(result.current.frakContext).toEqual(mockContext);
        expect(FrakContextManager.parse).toHaveBeenCalledWith({ url: mockUrl });
    });

    it("should update context when updateContext is called", () => {
        const mockUrl = "https://example.com?r=test-referrer";
        const newContext = { r: "new-referrer" };

        // Setup mocks
        (useWindowLocation as unknown as MockFn).mockReturnValue({
            location: { href: mockUrl },
            href: mockUrl,
        });

        const { result } = renderHook(() => useFrakContext());

        // Call updateContext
        act(() => {
            result.current.updateContext(newContext);
        });

        // Verify replaceUrl was called with correct arguments
        expect(FrakContextManager.replaceUrl).toHaveBeenCalledWith({
            url: mockUrl,
            context: newContext,
        });

        // Verify console.log was called
        expect(consoleLogSpy).toHaveBeenCalledWith("Updating context", {
            newContext,
        });
    });

    it("should not try to update context when location is undefined", () => {
        // Mock location as undefined
        (useWindowLocation as unknown as MockFn).mockReturnValue({
            location: undefined,
            href: undefined,
        });

        const { result } = renderHook(() => useFrakContext());

        // Call updateContext
        act(() => {
            result.current.updateContext({ r: "new-referrer" });
        });

        // Verify replaceUrl was called with undefined url
        expect(FrakContextManager.replaceUrl).toHaveBeenCalledWith({
            url: undefined,
            context: { r: "new-referrer" },
        });
    });

    it("should return a stable updateContext function when href doesn't change", () => {
        const mockUrl = "https://example.com?r=test-referrer";

        // Setup mocks
        (useWindowLocation as unknown as MockFn).mockReturnValue({
            location: { href: mockUrl },
            href: mockUrl,
        });

        const { result, rerender } = renderHook(() => useFrakContext());

        // Store the original updateContext function
        const originalUpdateContext = result.current.updateContext;

        // Rerender with the same URL
        rerender();

        // The function reference should be the same
        expect(result.current.updateContext).toBe(originalUpdateContext);
    });

    it("should return a new updateContext function when href changes", () => {
        const mockUrl1 = "https://example.com?r=test-referrer";
        const mockUrl2 = "https://example.com?r=different-referrer";

        // Setup initial mock
        (useWindowLocation as unknown as MockFn).mockReturnValue({
            location: { href: mockUrl1 },
            href: mockUrl1,
        });

        const { result, rerender } = renderHook(() => useFrakContext());

        // Store the original updateContext function
        const originalUpdateContext = result.current.updateContext;

        // Update mock to return different URL
        (useWindowLocation as unknown as MockFn).mockReturnValue({
            location: { href: mockUrl2 },
            href: mockUrl2,
        });

        // Rerender with the different URL
        rerender();

        // The function reference should be different
        expect(result.current.updateContext).not.toBe(originalUpdateContext);
    });
});
