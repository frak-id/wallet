import { backendApi } from "@frak-labs/client/server";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
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

const mockAdminWallet =
    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd0000000000000000000000000000000000000000000000000000000000000000";

describe("useGetAdminWallet", () => {
    describe("fetch by key", () => {
        test("should fetch admin wallet for key", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock successful API response
            vi.mocked(backendApi.common.adminWallet.get).mockResolvedValueOnce({
                data: {
                    pubKey: mockAdminWallet,
                },
                error: null,
                response: {} as Response,
                status: 200,
                headers: {},
            });

            const { result } = renderHook(
                () => useGetAdminWallet({ key: "test-admin-key" }),
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
                response: {} as Response,
                status: 200,
                headers: {},
            });

            const { result } = renderHook(
                () => useGetAdminWallet({ key: "test-admin-key" }),
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
                error: null as any,
                response: {} as Response,
                status: 200,
                headers: {},
            });

            const { result } = renderHook(
                () => useGetAdminWallet({ key: "test-admin-key" }),
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
                response: {} as Response,
                status: 200,
                headers: {},
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
                response: {} as Response,
                status: 200,
                headers: {},
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
                error: { status: 400, value: mockError },
                response: {} as Response,
                status: 400,
                headers: {},
            });

            const { result } = renderHook(
                () => useGetAdminWallet({ key: "test-admin-key" }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual({
                status: 400,
                value: mockError,
            });
        });

        test("should handle API rejection", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock API rejection
            vi.mocked(backendApi.common.adminWallet.get).mockRejectedValueOnce(
                new Error("Network failure")
            );

            const { result } = renderHook(
                () => useGetAdminWallet({ key: "test-admin-key" }),
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
                () => useGetAdminWallet({ key: "test-admin-key" }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isLoading).toBe(true);
            expect(result.current.data).toBeUndefined();
        });
    });

    describe("query key generation", () => {
        test("should use key in query key when provided", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(backendApi.common.adminWallet.get).mockResolvedValueOnce({
                data: {
                    pubKey: mockAdminWallet,
                },
                error: null,
                response: {} as Response,
                status: 200,
                headers: {},
            });

            const { result } = renderHook(
                () => useGetAdminWallet({ key: "test-admin-key" }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Verify the API was called with key
            expect(backendApi.common.adminWallet.get).toHaveBeenCalledWith({
                query: { key: "test-admin-key" },
            });
        });

        test("should return same data for same key across multiple hook instances", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(backendApi.common.adminWallet.get).mockResolvedValue({
                data: {
                    pubKey: mockAdminWallet,
                },
                error: null,
                response: {} as Response,
                status: 200,
                headers: {},
            });

            // First hook instance
            const { result: result1 } = renderHook(
                () => useGetAdminWallet({ key: "test-admin-key" }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result1.current.isSuccess).toBe(true);
            });

            expect(result1.current.data).toBe(mockAdminWallet);

            // Second hook instance with same productId should get same data
            const { result: result2 } = renderHook(
                () => useGetAdminWallet({ key: "test-admin-key" }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result2.current.isSuccess).toBe(true);
            });

            // Both should have the same data
            expect(result2.current.data).toBe(mockAdminWallet);
        });

        test("should fetch different data for different keys", async ({
            queryWrapper,
        }: TestContext) => {
            const key1 = "admin-key-1";
            const key2 = "admin-key-2";
            const wallet1 =
                "0x1111111111111111111111111111111111111111000000000000000000000000000000000000000000000000000000000000";
            const wallet2 =
                "0x2222222222222222222222222222222222222222000000000000000000000000000000000000000000000000000000000000";

            // Mock different responses for different keys
            vi.mocked(backendApi.common.adminWallet.get)
                .mockResolvedValueOnce({
                    data: { pubKey: wallet1 },
                    error: null,
                    response: {} as Response,
                    status: 200,
                    headers: {},
                })
                .mockResolvedValueOnce({
                    data: { pubKey: wallet2 },
                    error: null,
                    response: {} as Response,
                    status: 200,
                    headers: {},
                });

            // Fetch for first key
            const { result: result1 } = renderHook(
                () => useGetAdminWallet({ key: key1 }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result1.current.isSuccess).toBe(true);
            });

            expect(result1.current.data).toBe(wallet1);

            // Fetch for second key
            const { result: result2 } = renderHook(
                () => useGetAdminWallet({ key: key2 }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result2.current.isSuccess).toBe(true);
            });

            expect(result2.current.data).toBe(wallet2);

            // Different data for different keys
            expect(result1.current.data).not.toBe(result2.current.data);
        });
    });
});
