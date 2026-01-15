import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { mockMerchantWebhooks } from "@/tests/mocks/backendApi";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useWebhookInteractionStatus } from "./useWebhookInteractionStatus";

// Mock the business API
vi.mock("@/context/api/backendClient", () => ({
    authenticatedBackendApi: {
        merchant: vi.fn(),
    },
}));

describe("useWebhookInteractionStatus", () => {
    const mockMerchantId = "test-merchant-uuid-123";

    describe("successful fetching", () => {
        test("should fetch webhook status successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const mockStatus = {
                isActive: true,
                url: "https://webhook.example.com/interaction",
                source: "custom" as const,
            };

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    get: vi.fn().mockResolvedValue({ data: mockStatus }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockStatus);
            expect(authenticatedBackendApi.merchant).toHaveBeenCalledWith({
                merchantId: mockMerchantId,
            });
        });

        test("should handle inactive webhook status", async ({
            queryWrapper,
        }: TestContext) => {
            const mockStatus = {
                isActive: false,
                url: null,
                source: null,
            };

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    get: vi.fn().mockResolvedValue({ data: mockStatus }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect((result.current.data as any)?.isActive).toBe(false);
        });

        test("should handle webhook with different sources", async ({
            queryWrapper,
        }: TestContext) => {
            const mockStatus = {
                isActive: true,
                url: "https://shopify.example.com/webhook",
                source: "shopify" as const,
            };

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    get: vi.fn().mockResolvedValue({ data: mockStatus }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect((result.current.data as any)?.source).toBe("shopify");
        });
    });

    describe("query configuration", () => {
        test("should use correct query key", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    get: vi.fn().mockResolvedValue({ data: {} }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Check query key after query has loaded
            const queries = queryWrapper.client.getQueryCache().getAll();
            const webhookQuery = queries.find((query) => {
                const key = query.queryKey;
                return (
                    key[0] === "merchant" &&
                    key[1] === "webhook-interaction" &&
                    key[2] === "status" &&
                    key[3] === mockMerchantId
                );
            });
            expect(webhookQuery).toBeDefined();
        });

        test("should create separate queries for different merchants", async ({
            queryWrapper,
        }: TestContext) => {
            const merchantId1 = "merchant-uuid-1";
            const merchantId2 = "merchant-uuid-2";

            const mockStatus1 = {
                isActive: true,
                url: "https://webhook1.example.com",
                source: "custom" as const,
            };

            const mockStatus2 = {
                isActive: false,
                url: null,
                source: null,
            };

            vi.mocked(authenticatedBackendApi.merchant)
                .mockReturnValueOnce(
                    mockMerchantWebhooks({
                        get: vi.fn().mockResolvedValue({ data: mockStatus1 }),
                    })
                )
                .mockReturnValueOnce(
                    mockMerchantWebhooks({
                        get: vi.fn().mockResolvedValue({ data: mockStatus2 }),
                    })
                );

            const { result: result1 } = renderHook(
                () => useWebhookInteractionStatus({ merchantId: merchantId1 }),
                { wrapper: queryWrapper.wrapper }
            );

            const { result: result2 } = renderHook(
                () => useWebhookInteractionStatus({ merchantId: merchantId2 }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result1.current.isSuccess).toBe(true);
                expect(result2.current.isSuccess).toBe(true);
            });

            expect((result1.current.data as any)?.isActive).toBe(true);
            expect((result2.current.data as any)?.isActive).toBe(false);
        });
    });

    describe("error handling", () => {
        test("should handle API errors gracefully", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    get: vi
                        .fn()
                        .mockRejectedValue(
                            new Error("Failed to fetch webhook status")
                        ),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBeInstanceOf(Error);
            expect((result.current.error as Error).message).toBe(
                "Failed to fetch webhook status"
            );
        });

        test("should handle network errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    get: vi.fn().mockRejectedValue(new Error("Network error")),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.data).toBeUndefined();
        });

        test("should handle undefined response data", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    get: vi.fn().mockResolvedValue({ data: undefined }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                // When API returns undefined data, query is still successful
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toBeUndefined();
        });
    });

    describe("loading states", () => {
        test("should show loading state initially", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    get: vi.fn().mockImplementation(
                        () =>
                            new Promise((resolve) =>
                                setTimeout(
                                    () =>
                                        resolve({
                                            data: { isActive: true },
                                        }),
                                    100
                                )
                            )
                    ),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isLoading).toBe(true);
            expect(result.current.data).toBeUndefined();
        });

        test("should transition from loading to success", async ({
            queryWrapper,
        }: TestContext) => {
            const mockStatus = {
                isActive: true,
                url: "https://webhook.example.com",
                source: "custom" as const,
            };

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    get: vi.fn().mockResolvedValue({ data: mockStatus }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            // Initially loading
            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // After success
            expect(result.current.isLoading).toBe(false);
            expect(result.current.data).toEqual(mockStatus);
        });
    });

    describe("refetching", () => {
        test("should support manual refetch", async ({
            queryWrapper,
        }: TestContext) => {
            const getMock = vi
                .fn()
                .mockResolvedValueOnce({
                    data: { isActive: false },
                })
                .mockResolvedValueOnce({
                    data: { isActive: true },
                });

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    get: getMock,
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect((result.current.data as any)?.isActive).toBe(false);

            // Refetch
            await result.current.refetch();

            await waitFor(() => {
                expect((result.current.data as any)?.isActive).toBe(true);
            });

            expect(getMock).toHaveBeenCalledTimes(2);
        });
    });
});
