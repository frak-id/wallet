import { indexerApi } from "@frak-labs/client/server";
import { renderHook, waitFor } from "@testing-library/react";
import type { Address, Hex } from "viem";
import { multicall } from "viem/actions";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useGetProductFunding } from "./useGetProductFunding";

// Mock indexer API
vi.mock("@frak-labs/client/server", () => ({
    indexerApi: {
        get: vi.fn(() => ({
            json: vi.fn(),
        })),
    },
}));

// Mock viem multicall
vi.mock("viem/actions", () => ({
    multicall: vi.fn(),
}));

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

            // Check first mock bank
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

            // Should be loading initially
            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });
    });

    describe("live mode", () => {
        test("should fetch funding from indexer API and blockchain", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            const mockApiResponse = [
                {
                    address:
                        "0x1111111111111111111111111111111111111111" as Address,
                    totalDistributed: "5000000000",
                    totalClaimed: "2500000000",
                    isDistributing: true,
                    token: {
                        address:
                            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
                        name: "USD Coin",
                        symbol: "USDC",
                        decimals: 6,
                    },
                },
            ];

            const jsonMock = vi.fn().mockResolvedValue(mockApiResponse);
            vi.mocked(indexerApi.get).mockReturnValue({
                json: jsonMock,
            } as any);

            // Mock balance from multicall
            vi.mocked(multicall).mockResolvedValue([12500000000n] as any);

            const { result } = renderHook(
                () => useGetProductFunding({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(indexerApi.get).toHaveBeenCalledWith(
                `products/${mockProductId}/banks`
            );
            expect(result.current.data).toHaveLength(1);
            expect(result.current.data?.[0].balance).toBe(12500000000n);
        });

        test("should map string values to bigint", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            const mockApiResponse = [
                {
                    address:
                        "0x1111111111111111111111111111111111111111" as Address,
                    totalDistributed: "1000000000000000000", // String
                    totalClaimed: "500000000000000000", // String
                    isDistributing: false,
                    token: {
                        address:
                            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
                        name: "DAI",
                        symbol: "DAI",
                        decimals: 18,
                    },
                },
            ];

            const jsonMock = vi.fn().mockResolvedValue(mockApiResponse);
            vi.mocked(indexerApi.get).mockReturnValue({
                json: jsonMock,
            } as any);

            vi.mocked(multicall).mockResolvedValue([
                1000000000000000000n,
            ] as any);

            const { result } = renderHook(
                () => useGetProductFunding({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.[0].totalDistributed).toBe(
                1000000000000000000n
            );
            expect(result.current.data?.[0].totalClaimed).toBe(
                500000000000000000n
            );
        });

        test("should handle multiple funding banks", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            const mockApiResponse = [
                {
                    address:
                        "0x1111111111111111111111111111111111111111" as Address,
                    totalDistributed: "1000",
                    totalClaimed: "500",
                    isDistributing: true,
                    token: {
                        address:
                            "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as Address,
                        name: "USDC",
                        symbol: "USDC",
                        decimals: 6,
                    },
                },
                {
                    address:
                        "0x2222222222222222222222222222222222222222" as Address,
                    totalDistributed: "2000",
                    totalClaimed: "1000",
                    isDistributing: false,
                    token: {
                        address:
                            "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" as Address,
                        name: "DAI",
                        symbol: "DAI",
                        decimals: 18,
                    },
                },
            ];

            const jsonMock = vi.fn().mockResolvedValue(mockApiResponse);
            vi.mocked(indexerApi.get).mockReturnValue({
                json: jsonMock,
            } as any);

            vi.mocked(multicall).mockResolvedValue([
                5000000000n,
                8000000000000000000000n,
            ] as any);

            const { result } = renderHook(
                () => useGetProductFunding({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toHaveLength(2);
            expect(result.current.data?.[0].balance).toBe(5000000000n);
            expect(result.current.data?.[1].balance).toBe(
                8000000000000000000000n
            );
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

    describe("error handling", () => {
        test("should handle API errors", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            const jsonMock = vi
                .fn()
                .mockRejectedValue(new Error("Failed to fetch funding"));
            vi.mocked(indexerApi.get).mockReturnValue({
                json: jsonMock,
            } as any);

            const { result } = renderHook(
                () => useGetProductFunding({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });
        });

        test("should handle multicall errors", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            const mockApiResponse = [
                {
                    address:
                        "0x1111111111111111111111111111111111111111" as Address,
                    totalDistributed: "1000",
                    totalClaimed: "500",
                    isDistributing: true,
                    token: {
                        address:
                            "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as Address,
                        name: "USDC",
                        symbol: "USDC",
                        decimals: 6,
                    },
                },
            ];

            const jsonMock = vi.fn().mockResolvedValue(mockApiResponse);
            vi.mocked(indexerApi.get).mockReturnValue({
                json: jsonMock,
            } as any);

            vi.mocked(multicall).mockRejectedValue(
                new Error("Multicall failed")
            );

            const { result } = renderHook(
                () => useGetProductFunding({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });
        });
    });

    describe("query key", () => {
        test("should use different query key for demo vs live mode", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            // Test demo mode
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

            // Test live mode - clear cache and create new wrapper
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            const jsonMock = vi.fn().mockResolvedValue([]);
            vi.mocked(indexerApi.get).mockReturnValue({
                json: jsonMock,
            } as any);
            vi.mocked(multicall).mockResolvedValue([] as any);

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
