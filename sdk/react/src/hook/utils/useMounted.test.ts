/**
 * Tests for useMounted hook
 * Tests that the hook correctly tracks component mount state
 */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "../../../tests/vitest-fixtures";
import { useMounted } from "./useMounted";

describe("useMounted", () => {
    it("should return true after mount", async () => {
        const { result } = renderHook(() => useMounted());

        // In React Testing Library, effects run synchronously after render
        // So by the time we check result.current, the effect has already run
        await waitFor(() => {
            expect(result.current).toBe(true);
        });
    });

    it("should remain true after multiple re-renders", async () => {
        const { result, rerender } = renderHook(() => useMounted());

        // Wait for initial mount
        await waitFor(() => {
            expect(result.current).toBe(true);
        });

        // Re-render multiple times
        rerender();
        expect(result.current).toBe(true);

        rerender();
        expect(result.current).toBe(true);

        rerender();
        expect(result.current).toBe(true);
    });

    it("should be stable across re-renders", async () => {
        const { result, rerender } = renderHook(() => useMounted());

        // Wait for mount
        await waitFor(() => {
            expect(result.current).toBe(true);
        });

        const firstValue = result.current;

        // Re-render
        rerender();
        const secondValue = result.current;

        // Values should be the same
        expect(firstValue).toBe(secondValue);
        expect(firstValue).toBe(true);
    });

    it("should handle unmounting gracefully", async () => {
        const { result, unmount } = renderHook(() => useMounted());

        // Wait for mount
        await waitFor(() => {
            expect(result.current).toBe(true);
        });

        // Unmount should not throw
        expect(() => unmount()).not.toThrow();
    });
});
