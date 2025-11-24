import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useDemoMode, useIsDemoMode } from "./demoMode";

// Mock auth store with a variable we can control - use vi.hoisted to make it available in the mock factory
const { mockUseAuthStore } = vi.hoisted(() => ({
    mockUseAuthStore: vi.fn(),
}));

vi.mock("@/stores/authStore", () => ({
    useAuthStore: mockUseAuthStore,
}));

describe("demoMode atoms", () => {
    describe("useIsDemoMode", () => {
        test("should return false when demo mode is disabled", async ({
            queryWrapper,
        }: TestContext) => {
            mockUseAuthStore.mockImplementation((selector: any) => {
                const state = { token: "regular-token" };
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
            mockUseAuthStore.mockImplementation((selector: any) => {
                const state = { token: "demo-token" };
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

        test("should enable demo mode when setDemoMode(true) is called", async ({
            queryWrapper,
        }: TestContext) => {
            const mockSetAuth = vi.fn();
            const mockClearAuth = vi.fn();

            mockUseAuthStore.mockImplementation((selector: any) => {
                const state = {
                    token: null,
                    setAuth: mockSetAuth,
                    clearAuth: mockClearAuth,
                };
                return selector(state);
            });

            const invalidateQueriesSpy = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );

            const { result } = renderHook(() => useDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            result.current.setDemoMode(true);

            expect(mockSetAuth).toHaveBeenCalledWith(
                "demo-token",
                expect.any(String),
                expect.any(Number)
            );
            expect(invalidateQueriesSpy).toHaveBeenCalled();
        });

        test("should disable demo mode when setDemoMode(false) is called", async ({
            queryWrapper,
        }: TestContext) => {
            const mockSetAuth = vi.fn();
            const mockClearAuth = vi.fn();

            mockUseAuthStore.mockImplementation((selector: any) => {
                const state = {
                    token: "demo-token",
                    setAuth: mockSetAuth,
                    clearAuth: mockClearAuth,
                };
                return selector(state);
            });

            const invalidateQueriesSpy = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );

            const { result } = renderHook(() => useDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            result.current.setDemoMode(false);

            expect(mockClearAuth).toHaveBeenCalled();
            expect(invalidateQueriesSpy).toHaveBeenCalled();
        });

        test("should always invalidate queries when setDemoMode is called", async ({
            queryWrapper,
        }: TestContext) => {
            const mockSetAuth = vi.fn();
            const mockClearAuth = vi.fn();

            mockUseAuthStore.mockImplementation((selector: any) => {
                const state = {
                    token: "demo-token",
                    setAuth: mockSetAuth,
                    clearAuth: mockClearAuth,
                };
                return selector(state);
            });

            const invalidateQueriesSpy = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );

            const { result } = renderHook(() => useDemoMode(), {
                wrapper: queryWrapper.wrapper,
            });

            result.current.setDemoMode(true);

            expect(invalidateQueriesSpy).toHaveBeenCalled();
        });
    });
});
