import { renderHook, waitFor } from "@testing-library/react";
import type { Address, Hex } from "viem";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useGetProductAdministrators } from "./useGetProductAdministrators";

describe("useGetProductAdministrators", () => {
    const mockProductId = "0x1234567890123456789012345678901234567890" as Hex;

    describe("demo mode", () => {
        test("should return mock administrators in demo mode", async ({
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
                () => useGetProductAdministrators({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBeDefined();
            expect(Array.isArray(result.current.data)).toBe(true);
            expect(result.current.data).toHaveLength(3);

            expect(result.current.data?.[0].isOwner).toBe(true);
            expect(result.current.data?.[0].roleDetails.admin).toBe(true);
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
                () => useGetProductAdministrators({ productId: mockProductId }),
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
                () => useGetProductAdministrators({ productId: mockProductId }),
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
                () =>
                    useGetProductAdministrators({
                        productId: undefined as unknown as Hex,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(true);
            expect(result.current.data).toBeUndefined();
        });
    });
});
