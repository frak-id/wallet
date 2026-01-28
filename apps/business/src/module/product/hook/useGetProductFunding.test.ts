import { renderHook, waitFor } from "@testing-library/react";
import type { Address, Hex } from "viem";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useGetProductFunding } from "./useGetProductFunding";

describe("useGetProductFunding", () => {
    const mockProductId = "0x1234567890123456789012345678901234567890" as Hex;

    describe("demo mode", () => {
        test("should return mock funding data in demo mode", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore
                .getState()
                .setAuth(
                    "demo-token",
                    "0x0000000000000000000000000000000000000000" as Address,
                    Date.now() + 1000000
                );

            const { result } = renderHook(
                () => useGetProductFunding({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBeDefined();
            expect(Array.isArray(result.current.data)).toBe(true);
            expect(result.current.data).toHaveLength(2);

            expect(result.current.data?.[0].isDistributing).toBe(true);
            expect(result.current.data?.[0].token.symbol).toBe("USDC");
        });

        test("should simulate network delay in demo mode", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore
                .getState()
                .setAuth(
                    "demo-token",
                    "0x0000000000000000000000000000000000000000" as Address,
                    Date.now() + 1000000
                );

            const { result } = renderHook(
                () => useGetProductFunding({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });
    });

    describe("live mode (stubbed — indexer removed)", () => {
        test("should return empty array when not in demo mode", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            const { result } = renderHook(
                () => useGetProductFunding({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual([]);
        });
    });

    describe("query enabled state", () => {
        test("should be disabled when no productId provided", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(
                () => useGetProductFunding({ productId: undefined }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(true);
            expect(result.current.data).toBeUndefined();
        });
    });

    describe("query key", () => {
        test("should use different query key for demo vs live mode", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore
                .getState()
                .setAuth(
                    "demo-token",
                    "0x0000000000000000000000000000000000000000" as Address,
                    Date.now() + 1000000
                );

            const { result: demoResult } = renderHook(
                () => useGetProductFunding({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(demoResult.current.isSuccess).toBe(true);
            });

            expect(demoResult.current.data).toHaveLength(2);

            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            const { result: liveResult } = renderHook(
                () => useGetProductFunding({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(liveResult.current.isSuccess).toBe(true);
            });

            expect(liveResult.current.data).toHaveLength(0);
        });
    });
});
