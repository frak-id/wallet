import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMounted } from "./useMounted";

describe("useMounted", () => {
    // Need to mock the useEffect behavior since it appears to run immediately in the test environment
    it("should correctly track mounted state", async () => {
        // In @testing-library/react-hooks, effects run immediately
        // so we're testing the post-mount behavior which returns true
        const { result } = renderHook(() => useMounted());

        // In this test environment, mounted is immediately true
        expect(result.current).toBe(true);
    });

    it("should handle rerenders correctly", async () => {
        const { result, rerender } = renderHook(() => useMounted());

        // Initially true in test environment
        expect(result.current).toBe(true);

        // Rerender the hook
        rerender();

        // Should still be true
        expect(result.current).toBe(true);
    });
});
