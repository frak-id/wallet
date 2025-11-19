import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useDemoMode, useIsDemoMode } from "./demoMode";

// Mock auth store
vi.mock("@/stores/authStore", () => ({
    useAuthStore: vi.fn((selector: any) => {
        const state = {
            isDemoMode: false,
            setDemoMode: vi.fn(),
        };
        return selector(state);
    }),
}));

describe("demoMode atoms", () => {
    describe("useIsDemoMode", () => {
        test("should return false when demo mode is disabled", async ({
            queryWrapper,
        }: TestContext) => {
            const { useAuthStore } = await import("@/stores/authStore");

            vi.mocked(useAuthStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            const { result } = renderHook(() => useIsDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            expect(result.current).toBe(false);
        });

        test("should return true when demo mode is enabled", async ({
            queryWrapper,
        }: TestContext) => {
            const { useAuthStore } = await import("@/stores/authStore");

            vi.mocked(useAuthStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: true };
                return selector(state);
            });

            const { result } = renderHook(() => useIsDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            expect(result.current).toBe(true);
        });

        test("should return boolean value", ({ queryWrapper }: TestContext) => {
            const { result } = renderHook(() => useIsDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            expect(typeof result.current).toBe("boolean");
        });
    });

    describe("useDemoMode", () => {
        test("should return isDemoMode and setDemoMode", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(() => useDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            expect(result.current).toHaveProperty("isDemoMode");
            expect(result.current).toHaveProperty("setDemoMode");
            expect(typeof result.current.isDemoMode).toBe("boolean");
            expect(typeof result.current.setDemoMode).toBe("function");
        });

        test("should call store setDemoMode", async ({
            queryWrapper,
        }: TestContext) => {
            const { useAuthStore } = await import("@/stores/authStore");

            const mockSetDemoMode = vi.fn();

            vi.mocked(useAuthStore).mockImplementation((selector: any) => {
                const state = {
                    isDemoMode: false,
                    setDemoMode: mockSetDemoMode,
                };
                return selector(state);
            });

            const { result } = renderHook(() => useDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            result.current.setDemoMode(true);

            expect(mockSetDemoMode).toHaveBeenCalledWith(true);
        });

        test("should invalidate queries when demo mode changes", async ({
            queryWrapper,
        }: TestContext) => {
            const { useAuthStore } = await import("@/stores/authStore");

            const mockSetDemoMode = vi.fn();
            const invalidateQueriesSpy = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );

            vi.mocked(useAuthStore).mockImplementation((selector: any) => {
                const state = {
                    isDemoMode: false, // Currently false
                    setDemoMode: mockSetDemoMode,
                };
                return selector(state);
            });

            const { result } = renderHook(() => useDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            // Set to true (change)
            result.current.setDemoMode(true);

            expect(mockSetDemoMode).toHaveBeenCalledWith(true);
            expect(invalidateQueriesSpy).toHaveBeenCalled();
        });

        test("should NOT invalidate queries when demo mode does not change", async ({
            queryWrapper,
        }: TestContext) => {
            const { useAuthStore } = await import("@/stores/authStore");

            const mockSetDemoMode = vi.fn();
            const invalidateQueriesSpy = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );

            vi.mocked(useAuthStore).mockImplementation((selector: any) => {
                const state = {
                    isDemoMode: true, // Currently true
                    setDemoMode: mockSetDemoMode,
                };
                return selector(state);
            });

            const { result } = renderHook(() => useDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            // Set to true (no change)
            result.current.setDemoMode(true);

            expect(mockSetDemoMode).toHaveBeenCalledWith(true);
            expect(invalidateQueriesSpy).not.toHaveBeenCalled();
        });
    });
});
