import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMounted } from "./useMounted";
import { useWindowLocation } from "./useWindowLocation";

// Mock dependencies
vi.mock("./useMounted", () => ({
    useMounted: vi.fn(),
}));

describe("useWindowLocation", () => {
    // Mock window.location
    const originalLocation = window.location;
    const mockLocation = {
        href: "https://example.com",
        pathname: "/test",
        search: "?query=test",
        hash: "#hash",
        assign: vi.fn(),
        replace: vi.fn(),
        reload: vi.fn(),
        toString: vi.fn(),
    };

    // Mock addEventListener and removeEventListener
    const originalAddEventListener = window.addEventListener;
    const originalRemoveEventListener = window.removeEventListener;

    let addEventListenerMock: ReturnType<typeof vi.fn>;
    let removeEventListenerMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Mock useMounted to return true by default
        (useMounted as ReturnType<typeof vi.fn>).mockReturnValue(true);

        // Mock window.location
        Object.defineProperty(window, "location", {
            writable: true,
            value: mockLocation,
        });

        // Mock event listeners
        addEventListenerMock = vi.fn();
        removeEventListenerMock = vi.fn();
        window.addEventListener = addEventListenerMock;
        window.removeEventListener = removeEventListenerMock;
    });

    afterEach(() => {
        // Restore original window properties
        Object.defineProperty(window, "location", {
            writable: true,
            value: originalLocation,
        });

        window.addEventListener = originalAddEventListener;
        window.removeEventListener = originalRemoveEventListener;
    });

    it("should return window.location when component is mounted", () => {
        // Ensure useMounted returns true
        (useMounted as ReturnType<typeof vi.fn>).mockReturnValue(true);

        const { result } = renderHook(() => useWindowLocation());

        expect(result.current.location).toBe(mockLocation);
        expect(result.current.href).toBe(mockLocation.href);
    });

    it("should return undefined when component is not mounted", () => {
        // Mock useMounted to return false
        (useMounted as ReturnType<typeof vi.fn>).mockReturnValue(false);

        const { result } = renderHook(() => useWindowLocation());

        expect(result.current.location).toBeUndefined();
        expect(result.current.href).toBeUndefined();
    });

    it("should set up popstate event listener when mounted", () => {
        renderHook(() => useWindowLocation());

        // Verify that addEventListener was called with 'popstate'
        expect(addEventListenerMock).toHaveBeenCalledWith(
            "popstate",
            expect.any(Function)
        );
    });

    it("should clean up event listener on unmount", () => {
        const { unmount } = renderHook(() => useWindowLocation());

        // Unmount the hook
        unmount();

        // Verify that removeEventListener was called with 'popstate'
        expect(removeEventListenerMock).toHaveBeenCalledWith(
            "popstate",
            expect.any(Function)
        );
    });

    it("should not set up event listener if not mounted", () => {
        // Mock useMounted to return false
        (useMounted as ReturnType<typeof vi.fn>).mockReturnValue(false);

        renderHook(() => useWindowLocation());

        // Verify that addEventListener was not called
        expect(addEventListenerMock).not.toHaveBeenCalled();
    });

    it("should update location when popstate is triggered", () => {
        // We need to capture the event handler to call it manually
        let capturedHandler: (() => void) | undefined;
        addEventListenerMock.mockImplementation((event, handler) => {
            if (event === "popstate") {
                capturedHandler = handler as () => void;
            }
        });

        // Initial render
        const { result, rerender } = renderHook(() => useWindowLocation());

        // Change the location
        const newLocation = {
            ...mockLocation,
            href: "https://example.com/new",
        };
        Object.defineProperty(window, "location", {
            writable: true,
            value: newLocation,
        });

        // Trigger the popstate event handler if defined
        if (capturedHandler) {
            capturedHandler();
        }

        // Rerender to see changes
        rerender();

        // Updated location should be reflected
        expect(result.current.location).toBe(newLocation);
        expect(result.current.href).toBe(newLocation.href);
    });

    it("should derive href from location correctly", () => {
        // Set up a specific href value
        const specificHref = "https://example.com/test?query=value#hash";
        Object.defineProperty(mockLocation, "href", {
            writable: true,
            value: specificHref,
        });

        const { result } = renderHook(() => useWindowLocation());

        // Verify href matches the specific value
        expect(result.current.href).toBe(specificHref);
    });
});
