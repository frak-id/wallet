import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useWebhookInteractionStatus } from "./useWebhookInteractionStatus";

// Mock the business API
vi.mock("@frak-labs/client/server", () => ({
    businessApi: {
        product: vi.fn(() => ({
            interactionsWebhook: {
                status: {
                    get: vi.fn(),
                },
            },
        })),
    },
}));

describe("useWebhookInteractionStatus", () => {
    const mockProductId = "0x1234567890123456789012345678901234567890" as Hex;

    describe("successful fetching", () => {
        test("should fetch webhook status successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            const mockStatus = {
                isActive: true,
                url: "https://webhook.example.com/interaction",
                source: "custom" as const,
            };

            vi.mocked(businessApi.product).mockReturnValue({
                interactionsWebhook: {
                    status: {
                        get: vi.fn().mockResolvedValue({ data: mockStatus }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionStatus({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockStatus);
            expect(businessApi.product).toHaveBeenCalledWith({
                productId: mockProductId,
            });
        });

        test("should handle inactive webhook status", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            const mockStatus = {
                isActive: false,
                url: null,
                source: null,
            };

            vi.mocked(businessApi.product).mockReturnValue({
                interactionsWebhook: {
                    status: {
                        get: vi.fn().mockResolvedValue({ data: mockStatus }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionStatus({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.isActive).toBe(false);
        });

        test("should handle webhook with different sources", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            const mockStatus = {
                isActive: true,
                url: "https://shopify.example.com/webhook",
                source: "shopify" as const,
            };

            vi.mocked(businessApi.product).mockReturnValue({
                interactionsWebhook: {
                    status: {
                        get: vi.fn().mockResolvedValue({ data: mockStatus }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionStatus({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.source).toBe("shopify");
        });
    });

    describe("query configuration", () => {
        test("should use correct query key", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product).mockReturnValue({
                interactionsWebhook: {
                    status: {
                        get: vi.fn().mockResolvedValue({ data: {} }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionStatus({ productId: mockProductId }),
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
                    key[0] === "product" &&
                    key[1] === "webhook-interaction" &&
                    key[2] === "status" &&
                    key[3] === mockProductId
                );
            });
            expect(webhookQuery).toBeDefined();
        });

        test("should create separate queries for different products", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            const productId1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const productId2 =
                "0x2222222222222222222222222222222222222222" as Hex;

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

            vi.mocked(businessApi.product)
                .mockReturnValueOnce({
                    interactionsWebhook: {
                        status: {
                            get: vi
                                .fn()
                                .mockResolvedValue({ data: mockStatus1 }),
                        },
                    },
                } as any)
                .mockReturnValueOnce({
                    interactionsWebhook: {
                        status: {
                            get: vi
                                .fn()
                                .mockResolvedValue({ data: mockStatus2 }),
                        },
                    },
                } as any);

            const { result: result1 } = renderHook(
                () => useWebhookInteractionStatus({ productId: productId1 }),
                { wrapper: queryWrapper.wrapper }
            );

            const { result: result2 } = renderHook(
                () => useWebhookInteractionStatus({ productId: productId2 }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result1.current.isSuccess).toBe(true);
                expect(result2.current.isSuccess).toBe(true);
            });

            expect(result1.current.data?.isActive).toBe(true);
            expect(result2.current.data?.isActive).toBe(false);
        });
    });

    describe("error handling", () => {
        test("should handle API errors gracefully", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product).mockReturnValue({
                interactionsWebhook: {
                    status: {
                        get: vi
                            .fn()
                            .mockRejectedValue(
                                new Error("Failed to fetch webhook status")
                            ),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionStatus({ productId: mockProductId }),
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
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product).mockReturnValue({
                interactionsWebhook: {
                    status: {
                        get: vi
                            .fn()
                            .mockRejectedValue(new Error("Network error")),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionStatus({ productId: mockProductId }),
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
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product).mockReturnValue({
                interactionsWebhook: {
                    status: {
                        get: vi.fn().mockResolvedValue({ data: undefined }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionStatus({ productId: mockProductId }),
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
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product).mockReturnValue({
                interactionsWebhook: {
                    status: {
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
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionStatus({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isLoading).toBe(true);
            expect(result.current.data).toBeUndefined();
        });

        test("should transition from loading to success", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            const mockStatus = {
                isActive: true,
                url: "https://webhook.example.com",
                source: "custom" as const,
            };

            vi.mocked(businessApi.product).mockReturnValue({
                interactionsWebhook: {
                    status: {
                        get: vi.fn().mockResolvedValue({ data: mockStatus }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionStatus({ productId: mockProductId }),
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
            const { businessApi } = await import("@frak-labs/client/server");

            const getMock = vi
                .fn()
                .mockResolvedValueOnce({
                    data: { isActive: false },
                })
                .mockResolvedValueOnce({
                    data: { isActive: true },
                });

            vi.mocked(businessApi.product).mockReturnValue({
                interactionsWebhook: {
                    status: {
                        get: getMock,
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionStatus({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.isActive).toBe(false);

            // Refetch
            await result.current.refetch();

            await waitFor(() => {
                expect(result.current.data?.isActive).toBe(true);
            });

            expect(getMock).toHaveBeenCalledTimes(2);
        });
    });
});
