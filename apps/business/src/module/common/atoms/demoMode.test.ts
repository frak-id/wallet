import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useDemoMode, useIsDemoMode } from "./demoMode";

// Mock demo mode store
vi.mock("@/stores/demoModeStore", () => ({
    demoModeStore: vi.fn((selector: any) => {
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
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
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
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
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

        test("should call store setDemoMode with queryClient", async ({
            queryWrapper,
        }: TestContext) => {
            const { demoModeStore } = await import("@/stores/demoModeStore");

            const mockSetDemoMode = vi.fn();

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
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

            expect(mockSetDemoMode).toHaveBeenCalledWith(
                true,
                queryWrapper.client
            );
        });

        test("should handle setting demo mode to false", async ({
            queryWrapper,
        }: TestContext) => {
            const { demoModeStore } = await import("@/stores/demoModeStore");

            const mockSetDemoMode = vi.fn();

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = {
                    isDemoMode: true,
                    setDemoMode: mockSetDemoMode,
                };
                return selector(state);
            });

            const { result } = renderHook(() => useDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            result.current.setDemoMode(false);

            expect(mockSetDemoMode).toHaveBeenCalledWith(
                false,
                queryWrapper.client
            );
        });

        test("should have current isDemoMode value", async ({
            queryWrapper,
        }: TestContext) => {
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = {
                    isDemoMode: true,
                    setDemoMode: vi.fn(),
                };
                return selector(state);
            });

            const { result } = renderHook(() => useDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            expect(result.current.isDemoMode).toBe(true);
        });
    });

    describe("integration", () => {
        test("useIsDemoMode should return same value as useDemoMode().isDemoMode", async ({
            queryWrapper,
        }: TestContext) => {
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = {
                    isDemoMode: true,
                    setDemoMode: vi.fn(),
                };
                return selector(state);
            });

            const { result: simpleResult } = renderHook(() => useIsDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            const { result: fullResult } = renderHook(() => useDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            expect(simpleResult.current).toBe(fullResult.current.isDemoMode);
        });
    });
});
