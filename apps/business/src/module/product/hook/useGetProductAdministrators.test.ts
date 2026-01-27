import { renderHook, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useGetProductAdministrators } from "./useGetProductAdministrators";

describe("useGetProductAdministrators", () => {
    const mockMerchantId = "mock-merchant-id";

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
                () =>
                    useGetProductAdministrators({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBeDefined();
            expect(Array.isArray(result.current.data)).toBe(true);
            expect(result.current.data).toHaveLength(3);

            expect(result.current.data?.[0].isOwner).toBe(true);
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
                () =>
                    useGetProductAdministrators({ merchantId: mockMerchantId }),
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
                () =>
                    useGetProductAdministrators({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(indexerApi.get).toHaveBeenCalledWith(
                `merchants/${mockMerchantId}/administrators`
            );
            expect(result.current.data).toBeDefined();
        });

        test("should map roles correctly", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            const mockApiResponse = [
                {
                    wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as Address,
                    isOwner: false,
                    roles: "1", // productAdministrator
                    addedTimestamp: "1704067200",
                },
            ];

            const jsonMock = vi.fn().mockResolvedValue(mockApiResponse);
            vi.mocked(indexerApi.get).mockReturnValue({
                json: jsonMock,
            } as any);

            const { result } = renderHook(
                () =>
                    useGetProductAdministrators({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBeDefined();
        });

        test("should filter out purchaseOracleUpdater-only users", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            const mockApiResponse = [
                {
                    wallet: "0x1111111111111111111111111111111111111111" as Address,
                    isOwner: false,
                    roles: "8", // purchaseOracleUpdater only (bit 3 = 8)
                    addedTimestamp: "1704067200",
                },
                {
                    wallet: "0x2222222222222222222222222222222222222222" as Address,
                    isOwner: false,
                    roles: "1", // productAdministrator
                    addedTimestamp: "1704067200",
                },
            ];

            const jsonMock = vi.fn().mockResolvedValue(mockApiResponse);
            vi.mocked(indexerApi.get).mockReturnValue({
                json: jsonMock,
            } as any);

            const { result } = renderHook(
                () =>
                    useGetProductAdministrators({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Should have filtered out the purchaseOracleUpdater-only user
            expect(result.current.data).toHaveLength(1);
            expect(result.current.data?.[0].wallet).toBe(
                "0x2222222222222222222222222222222222222222"
            );
        });
    });

    describe("query enabled state", () => {
        test("should be disabled when no merchantId provided", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(
                () =>
                    useGetProductAdministrators({
                        merchantId: "",
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(true);
            expect(result.current.data).toBeUndefined();
        });
    });

    describe("error handling", () => {
        test("should handle API errors", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            const jsonMock = vi
                .fn()
                .mockRejectedValue(new Error("Failed to fetch administrators"));
            vi.mocked(indexerApi.get).mockReturnValue({
                json: jsonMock,
            } as any);

            const { result } = renderHook(
                () =>
                    useGetProductAdministrators({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBeInstanceOf(Error);
        });
    });
});
