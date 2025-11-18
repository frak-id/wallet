import { indexerApi } from "@frak-labs/client/server";
import { renderHook, waitFor } from "@testing-library/react";
import type { Address, Hex } from "viem";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useGetProductAdministrators } from "./useGetProductAdministrators";

// Mock indexer API
vi.mock("@frak-labs/client/server", () => ({
    indexerApi: {
        get: vi.fn(() => ({
            json: vi.fn(),
        })),
    },
}));

describe("useGetProductAdministrators", () => {
    const mockProductId = "0x1234567890123456789012345678901234567890" as Hex;

    describe("demo mode", () => {
        test("should return mock administrators in demo mode", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(true, queryWrapper.client);

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

            // Check first mock admin is owner
            expect(result.current.data?.[0].isOwner).toBe(true);
            expect(result.current.data?.[0].roleDetails.admin).toBe(true);
        });

        test("should simulate network delay in demo mode", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(true, queryWrapper.client);

            const { result } = renderHook(
                () => useGetProductAdministrators({ productId: mockProductId }),
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
        test("should fetch administrators from indexer API", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(false, queryWrapper.client);

            const mockApiResponse = [
                {
                    wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as Address,
                    isOwner: true,
                    roles: "0",
                    addedTimestamp: "1704067200",
                },
                {
                    wallet: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199" as Address,
                    isOwner: false,
                    roles: "3",
                    addedTimestamp: "1705276800",
                },
            ];

            const jsonMock = vi.fn().mockResolvedValue(mockApiResponse);
            vi.mocked(indexerApi.get).mockReturnValue({
                json: jsonMock,
            } as any);

            const { result } = renderHook(
                () => useGetProductAdministrators({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(indexerApi.get).toHaveBeenCalledWith(
                `products/${mockProductId}/administrators`
            );
            expect(result.current.data).toBeDefined();
        });

        test("should map roles correctly", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(false, queryWrapper.client);

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
                () => useGetProductAdministrators({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(
                result.current.data?.[0].roleDetails.productAdministrator
            ).toBe(true);
        });

        test("should filter out purchaseOracleUpdater-only users", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(false, queryWrapper.client);

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
                () => useGetProductAdministrators({ productId: mockProductId }),
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

    describe("error handling", () => {
        test("should handle API errors", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(false, queryWrapper.client);

            const jsonMock = vi
                .fn()
                .mockRejectedValue(new Error("Failed to fetch administrators"));
            vi.mocked(indexerApi.get).mockReturnValue({
                json: jsonMock,
            } as any);

            const { result } = renderHook(
                () => useGetProductAdministrators({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBeInstanceOf(Error);
        });
    });
});
