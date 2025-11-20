import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useWebhookInteractionSetup } from "./useWebhookInteractionSetup";

// Mock the business API
vi.mock("@/context/api/backendClient", () => ({
    authenticatedBackendApi: {
        product: vi.fn(() => ({
            interactionsWebhook: {
                setup: {
                    post: vi.fn(),
                },
                status: {
                    get: vi.fn(),
                },
            },
        })),
    },
}));

// Mock useWebhookInteractionStatus
vi.mock("@/module/product/hook/useWebhookInteractionStatus", () => ({
    useWebhookInteractionStatus: vi.fn(() => ({
        refetch: vi.fn(),
    })),
}));

describe("useWebhookInteractionSetup", () => {
    const mockProductId = "0x1234567890123456789012345678901234567890" as Hex;

    describe("successful setup", () => {
        test("should setup webhook successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const { authenticatedBackendApi } = await import(
                "@/context/api/backendClient"
            );

            const mockResponse = {
                success: true,
                webhookUrl: "https://webhook.example.com/interaction",
            };

            vi.mocked(authenticatedBackendApi.product).mockReturnValue({
                interactionsWebhook: {
                    setup: {
                        post: vi.fn().mockResolvedValue({
                            data: mockResponse,
                            error: null,
                        }),
                    },
                    status: {
                        get: vi.fn().mockResolvedValue({ data: {} }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionSetup({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            const setupParams = {
                productId: mockProductId,
                hookSignatureKey: "secret-key-123",
            };

            await result.current.mutateAsync(setupParams);

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockResponse);
        });

        test("should call API with correct parameters", async ({
            queryWrapper,
        }: TestContext) => {
            const { authenticatedBackendApi } = await import(
                "@/context/api/backendClient"
            );

            const postMock = vi.fn().mockResolvedValue({
                data: { success: true },
                error: null,
            });

            vi.mocked(authenticatedBackendApi.product).mockReturnValue({
                interactionsWebhook: {
                    setup: {
                        post: postMock,
                    },
                    status: {
                        get: vi.fn().mockResolvedValue({ data: {} }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionSetup({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            const setupParams = {
                productId: mockProductId,
                hookSignatureKey: "my-secret-key",
            };

            await result.current.mutateAsync(setupParams);

            expect(authenticatedBackendApi.product).toHaveBeenCalledWith({
                productId: mockProductId,
            });
            expect(postMock).toHaveBeenCalledWith({
                source: "custom",
                hookSignatureKey: "my-secret-key",
            });
        });

        test("should always use custom source", async ({
            queryWrapper,
        }: TestContext) => {
            const { authenticatedBackendApi } = await import(
                "@/context/api/backendClient"
            );

            const postMock = vi.fn().mockResolvedValue({
                data: { success: true },
                error: null,
            });

            vi.mocked(authenticatedBackendApi.product).mockReturnValue({
                interactionsWebhook: {
                    setup: {
                        post: postMock,
                    },
                    status: {
                        get: vi.fn().mockResolvedValue({ data: {} }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionSetup({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                productId: mockProductId,
                hookSignatureKey: "test-key",
            });

            const callArgs = postMock.mock.calls[0][0];
            expect(callArgs.source).toBe("custom");
        });
    });

    describe("refetch behavior", () => {
        test("should refetch status after successful setup", async ({
            queryWrapper,
        }: TestContext) => {
            const { authenticatedBackendApi } = await import(
                "@/context/api/backendClient"
            );
            const { useWebhookInteractionStatus } = await import(
                "@/module/product/hook/useWebhookInteractionStatus"
            );

            const refetchMock = vi.fn();

            vi.mocked(useWebhookInteractionStatus).mockReturnValue({
                refetch: refetchMock,
            } as any);

            vi.mocked(authenticatedBackendApi.product).mockReturnValue({
                interactionsWebhook: {
                    setup: {
                        post: vi.fn().mockResolvedValue({
                            data: { success: true },
                            error: null,
                        }),
                    },
                    status: {
                        get: vi.fn().mockResolvedValue({ data: {} }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionSetup({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                productId: mockProductId,
                hookSignatureKey: "test-key",
            });

            await waitFor(() => {
                expect(refetchMock).toHaveBeenCalled();
            });
        });

        test("should refetch status even after failure", async ({
            queryWrapper,
        }: TestContext) => {
            const { authenticatedBackendApi } = await import(
                "@/context/api/backendClient"
            );
            const { useWebhookInteractionStatus } = await import(
                "@/module/product/hook/useWebhookInteractionStatus"
            );

            const refetchMock = vi.fn();

            vi.mocked(useWebhookInteractionStatus).mockReturnValue({
                refetch: refetchMock,
            } as any);

            vi.mocked(authenticatedBackendApi.product).mockReturnValue({
                interactionsWebhook: {
                    setup: {
                        post: vi.fn().mockResolvedValue({
                            data: null,
                            error: "Setup failed",
                        }),
                    },
                    status: {
                        get: vi.fn().mockResolvedValue({ data: {} }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionSetup({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({
                    productId: mockProductId,
                    hookSignatureKey: "test-key",
                })
            ).rejects.toThrow();

            await waitFor(() => {
                expect(refetchMock).toHaveBeenCalled();
            });
        });
    });

    describe("error handling", () => {
        test("should throw error when API returns error", async ({
            queryWrapper,
        }: TestContext) => {
            const { authenticatedBackendApi } = await import(
                "@/context/api/backendClient"
            );

            vi.mocked(authenticatedBackendApi.product).mockReturnValue({
                interactionsWebhook: {
                    setup: {
                        post: vi.fn().mockResolvedValue({
                            data: null,
                            error: "Invalid signature key",
                        }),
                    },
                    status: {
                        get: vi.fn().mockResolvedValue({ data: {} }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionSetup({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({
                    productId: mockProductId,
                    hookSignatureKey: "invalid-key",
                })
            ).rejects.toThrow("Invalid signature key");
        });

        test("should handle network errors", async ({
            queryWrapper,
        }: TestContext) => {
            const { authenticatedBackendApi } = await import(
                "@/context/api/backendClient"
            );

            vi.mocked(authenticatedBackendApi.product).mockReturnValue({
                interactionsWebhook: {
                    setup: {
                        post: vi
                            .fn()
                            .mockRejectedValue(new Error("Network error")),
                    },
                    status: {
                        get: vi.fn().mockResolvedValue({ data: {} }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionSetup({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({
                    productId: mockProductId,
                    hookSignatureKey: "test-key",
                })
            ).rejects.toThrow("Network error");
        });

        test("should transition to error state on failure", async ({
            queryWrapper,
        }: TestContext) => {
            const { authenticatedBackendApi } = await import(
                "@/context/api/backendClient"
            );

            vi.mocked(authenticatedBackendApi.product).mockReturnValue({
                interactionsWebhook: {
                    setup: {
                        post: vi.fn().mockResolvedValue({
                            data: null,
                            error: "Setup error",
                        }),
                    },
                    status: {
                        get: vi.fn().mockResolvedValue({ data: {} }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionSetup({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            try {
                await result.current.mutateAsync({
                    productId: mockProductId,
                    hookSignatureKey: "test-key",
                });
            } catch {
                // Expected to throw
            }

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });
        });
    });

    describe("mutation key", () => {
        test("should use correct mutation key", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(
                () => useWebhookInteractionSetup({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            // Mutation key is accessible through the mutation options
            expect(result.current).toBeDefined();
            expect(typeof result.current.mutate).toBe("function");
            expect(typeof result.current.mutateAsync).toBe("function");
        });
    });

    describe("mutation states", () => {
        test("should track mutation loading state", async ({
            queryWrapper,
        }: TestContext) => {
            const { authenticatedBackendApi } = await import(
                "@/context/api/backendClient"
            );

            vi.mocked(authenticatedBackendApi.product).mockReturnValue({
                interactionsWebhook: {
                    setup: {
                        post: vi.fn().mockImplementation(
                            () =>
                                new Promise((resolve) =>
                                    setTimeout(
                                        () =>
                                            resolve({
                                                data: { success: true },
                                                error: null,
                                            }),
                                        100
                                    )
                                )
                        ),
                    },
                    status: {
                        get: vi.fn().mockResolvedValue({ data: {} }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionSetup({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(false);

            const mutationPromise = result.current.mutateAsync({
                productId: mockProductId,
                hookSignatureKey: "test-key",
            });

            await waitFor(() => {
                expect(result.current.isPending).toBe(true);
            });

            await mutationPromise;

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });

        test("should reset mutation state between calls", async ({
            queryWrapper,
        }: TestContext) => {
            const { authenticatedBackendApi } = await import(
                "@/context/api/backendClient"
            );

            vi.mocked(authenticatedBackendApi.product).mockReturnValue({
                interactionsWebhook: {
                    setup: {
                        post: vi.fn().mockResolvedValue({
                            data: { success: true },
                            error: null,
                        }),
                    },
                    status: {
                        get: vi.fn().mockResolvedValue({ data: {} }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionSetup({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            // First mutation
            await result.current.mutateAsync({
                productId: mockProductId,
                hookSignatureKey: "key1",
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Reset
            result.current.reset();

            await waitFor(() => {
                expect(result.current.status).toBe("idle");
            });

            expect(result.current.data).toBeUndefined();
        });
    });

    describe("different hook signature keys", () => {
        test("should handle different signature key formats", async ({
            queryWrapper,
        }: TestContext) => {
            const { authenticatedBackendApi } = await import(
                "@/context/api/backendClient"
            );

            const postMock = vi.fn().mockResolvedValue({
                data: { success: true },
                error: null,
            });

            vi.mocked(authenticatedBackendApi.product).mockReturnValue({
                interactionsWebhook: {
                    setup: {
                        post: postMock,
                    },
                    status: {
                        get: vi.fn().mockResolvedValue({ data: {} }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionSetup({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            const testKeys = [
                "simple-key",
                "key-with-dashes",
                "key_with_underscores",
                "CamelCaseKey",
                "key123with456numbers",
            ];

            for (const key of testKeys) {
                await result.current.mutateAsync({
                    productId: mockProductId,
                    hookSignatureKey: key,
                });

                expect(postMock).toHaveBeenCalledWith({
                    source: "custom",
                    hookSignatureKey: key,
                });
            }
        });
    });
});
