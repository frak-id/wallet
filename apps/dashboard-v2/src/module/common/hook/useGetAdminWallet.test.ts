import { backendApi } from "@frak-labs/client/server";
import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import { describe, expect, type TestContext, test } from "@/tests/fixtures";
import { useGetAdminWallet } from "./useGetAdminWallet";

// Mock the backend API
vi.mock("@frak-labs/client/server", () => ({
    backendApi: {
        common: {
            adminWallet: {
                get: vi.fn(),
            },
        },
    },
}));

const mockProductId =
    "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;
const mockAdminWallet =
    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd0000000000000000000000000000000000000000000000000000000000000000" as Hex;

describe("useGetAdminWallet", () => {
    describe("fetch by product ID", () => {
        test("should fetch admin wallet for product ID", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock successful API response
            vi.mocked(backendApi.common.adminWallet.get).mockResolvedValueOnce({
                data: {
                    pubKey: mockAdminWallet,
                },
                error: null,
            });

            const { result } = renderHook(
                () => useGetAdminWallet({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBe(mockAdminWallet);
        });

        test("should handle missing pubKey in response", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock response without pubKey
            vi.mocked(backendApi.common.adminWallet.get).mockResolvedValueOnce({
                data: {} as any,
                error: null,
            });

            const { result } = renderHook(
                () => useGetAdminWallet({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBeNull();
        });

        test("should handle null data in response", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock response with null data
            vi.mocked(backendApi.common.adminWallet.get).mockResolvedValueOnce({
                data: null,
                error: null,
            });

            const { result } = renderHook(
                () => useGetAdminWallet({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBeNull();
        });
    });

    describe("fetch by key", () => {
        test("should fetch admin wallet for key", async ({
            queryWrapper,
        }: TestContext) => {
            const mockKey = "test-admin-key";

            // Mock successful API response
            vi.mocked(backendApi.common.adminWallet.get).mockResolvedValueOnce({
                data: {
                    pubKey: mockAdminWallet,
                },
                error: null,
            });

            const { result } = renderHook(
                () => useGetAdminWallet({ key: mockKey }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBe(mockAdminWallet);
        });

        test("should use correct query key for key-based fetch", async ({
            queryWrapper,
        }: TestContext) => {
            const mockKey = "test-admin-key";

            vi.mocked(backendApi.common.adminWallet.get).mockResolvedValueOnce({
                data: {
                    pubKey: mockAdminWallet,
                },
                error: null,
            });

            const { result } = renderHook(
                () => useGetAdminWallet({ key: mockKey }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Verify the API was called with the key
            expect(backendApi.common.adminWallet.get).toHaveBeenCalledWith({
                query: { key: mockKey },
            });
        });
    });

    describe("error handling", () => {
        test("should throw error when API returns error", async ({
            queryWrapper,
        }: TestContext) => {
            const mockError = "Network error";

            // Mock API error
            vi.mocked(backendApi.common.adminWallet.get).mockResolvedValueOnce({
                data: null,
                error: mockError,
            });

            const { result } = renderHook(
                () => useGetAdminWallet({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBe(mockError);
        });

        test("should handle API rejection", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock API rejection
            vi.mocked(backendApi.common.adminWallet.get).mockRejectedValueOnce(
                new Error("Network failure")
            );

            const { result } = renderHook(
                () => useGetAdminWallet({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBeDefined();
        });
    });

    describe("loading state", () => {
        test("should show loading state initially", ({
            queryWrapper,
        }: TestContext) => {
            // Mock slow API response
            vi.mocked(backendApi.common.adminWallet.get).mockImplementation(
                () =>
                    new Promise(() => {
                        /* never resolves */
                    })
            );

            const { result } = renderHook(
                () => useGetAdminWallet({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isLoading).toBe(true);
            expect(result.current.data).toBeUndefined();
        });
    });

    describe("query key generation", () => {
        test("should use product ID in query key when provided", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(backendApi.common.adminWallet.get).mockResolvedValueOnce({
                data: {
                    pubKey: mockAdminWallet,
                },
                error: null,
            });

            const { result } = renderHook(
                () => useGetAdminWallet({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Verify the API was called with productId
            expect(backendApi.common.adminWallet.get).toHaveBeenCalledWith({
                query: { productId: mockProductId },
            });
        });

        test("should use key in query key when provided", async ({
            queryWrapper,
        }: TestContext) => {
            const mockKey = "admin-123";

            vi.mocked(backendApi.common.adminWallet.get).mockResolvedValueOnce({
                data: {
                    pubKey: mockAdminWallet,
                },
                error: null,
            });

            const { result } = renderHook(
                () => useGetAdminWallet({ key: mockKey }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Verify the API was called with key
            expect(backendApi.common.adminWallet.get).toHaveBeenCalledWith({
                query: { key: mockKey },
            });
        });
    });

    describe("query key generation", () => {
        test("should return same data for same product ID across multiple hook instances", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(backendApi.common.adminWallet.get).mockResolvedValue({
                data: {
                    pubKey: mockAdminWallet,
                },
                error: null,
            });

            // First hook instance
            const { result: result1 } = renderHook(
                () => useGetAdminWallet({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result1.current.isSuccess).toBe(true);
            });

            expect(result1.current.data).toBe(mockAdminWallet);

            // Second hook instance with same productId should get same data
            const { result: result2 } = renderHook(
                () => useGetAdminWallet({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result2.current.isSuccess).toBe(true);
            });

            // Both should have the same data
            expect(result2.current.data).toBe(mockAdminWallet);
        });

        test("should fetch different data for different product IDs", async ({
            queryWrapper,
        }: TestContext) => {
            const productId1 =
                "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;
            const productId2 =
                "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex;
            const wallet1 =
                "0x1111111111111111111111111111111111111111000000000000000000000000000000000000000000000000000000000000" as Hex;
            const wallet2 =
                "0x2222222222222222222222222222222222222222000000000000000000000000000000000000000000000000000000000000" as Hex;

            // Mock different responses for different product IDs
            vi.mocked(backendApi.common.adminWallet.get)
                .mockResolvedValueOnce({
                    data: { pubKey: wallet1 },
                    error: null,
                })
                .mockResolvedValueOnce({
                    data: { pubKey: wallet2 },
                    error: null,
                });

            // Fetch for first product
            const { result: result1 } = renderHook(
                () => useGetAdminWallet({ productId: productId1 }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result1.current.isSuccess).toBe(true);
            });

            expect(result1.current.data).toBe(wallet1);

            // Fetch for second product
            const { result: result2 } = renderHook(
                () => useGetAdminWallet({ productId: productId2 }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result2.current.isSuccess).toBe(true);
            });

            expect(result2.current.data).toBe(wallet2);

            // Different data for different IDs
            expect(result1.current.data).not.toBe(result2.current.data);
        });
    });
});
