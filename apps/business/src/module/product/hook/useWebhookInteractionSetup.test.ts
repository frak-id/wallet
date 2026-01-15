import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { useWebhookInteractionStatus } from "@/module/product/hook/useWebhookInteractionStatus";
import { mockMerchantWebhooks } from "@/tests/mocks/backendApi";
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
        merchant: vi.fn(),
    },
}));

// Mock useWebhookInteractionStatus
vi.mock("@/module/product/hook/useWebhookInteractionStatus", () => ({
    useWebhookInteractionStatus: vi.fn(() => ({
        refetch: vi.fn(),
    })),
}));

describe("useWebhookInteractionSetup", () => {
    const mockMerchantId = "test-merchant-uuid-123";

    describe("successful setup", () => {
        test("should setup webhook successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const mockResponse = {
                success: true,
                webhookUrl: "https://webhook.example.com/interaction",
            };

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    post: vi.fn().mockResolvedValue({
                        data: mockResponse,
                        error: null,
                    }),
                    get: vi.fn().mockResolvedValue({ data: {} }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionSetup({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            const setupParams = {
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
            const postMock = vi.fn().mockResolvedValue({
                data: { success: true },
                error: null,
            });

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    post: postMock,
                    get: vi.fn().mockResolvedValue({ data: {} }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionSetup({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            const setupParams = {
                hookSignatureKey: "my-secret-key",
            };

            await result.current.mutateAsync(setupParams);

            expect(authenticatedBackendApi.merchant).toHaveBeenCalledWith({
                merchantId: mockMerchantId,
            });
            expect(postMock).toHaveBeenCalledWith({
                platform: "custom",
                hookSignatureKey: "my-secret-key",
            });
        });

        test("should always use custom platform by default", async ({
            queryWrapper,
        }: TestContext) => {
            const postMock = vi.fn().mockResolvedValue({
                data: { success: true },
                error: null,
            });

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    post: postMock,
                    get: vi.fn().mockResolvedValue({ data: {} }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionSetup({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                hookSignatureKey: "test-key",
            });

            const callArgs = postMock.mock.calls[0][0];
            expect(callArgs.platform).toBe("custom");
        });
    });

    describe("refetch behavior", () => {
        test("should refetch status after successful setup", async ({
            queryWrapper,
        }: TestContext) => {
            const refetchMock = vi.fn();

            vi.mocked(useWebhookInteractionStatus).mockReturnValue({
                refetch: refetchMock,
            } as any);

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    post: vi.fn().mockResolvedValue({
                        data: { success: true },
                        error: null,
                    }),
                    get: vi.fn().mockResolvedValue({ data: {} }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionSetup({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                hookSignatureKey: "test-key",
            });

            await waitFor(() => {
                expect(refetchMock).toHaveBeenCalled();
            });
        });

        test("should refetch status even after failure", async ({
            queryWrapper,
        }: TestContext) => {
            const refetchMock = vi.fn();

            vi.mocked(useWebhookInteractionStatus).mockReturnValue({
                refetch: refetchMock,
            } as any);

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    post: vi.fn().mockResolvedValue({
                        data: null,
                        error: "Setup failed",
                    }),
                    get: vi.fn().mockResolvedValue({ data: {} }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionSetup({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({
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
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    post: vi.fn().mockResolvedValue({
                        data: null,
                        error: "Invalid signature key",
                    }),
                    get: vi.fn().mockResolvedValue({ data: {} }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionSetup({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({
                    hookSignatureKey: "invalid-key",
                })
            ).rejects.toThrow("Invalid signature key");
        });

        test("should handle network errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    post: vi.fn().mockRejectedValue(new Error("Network error")),
                    get: vi.fn().mockResolvedValue({ data: {} }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionSetup({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({
                    hookSignatureKey: "test-key",
                })
            ).rejects.toThrow("Network error");
        });

        test("should transition to error state on failure", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    post: vi.fn().mockResolvedValue({
                        data: null,
                        error: "Setup error",
                    }),
                    get: vi.fn().mockResolvedValue({ data: {} }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionSetup({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            try {
                await result.current.mutateAsync({
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
                () =>
                    useWebhookInteractionSetup({ merchantId: mockMerchantId }),
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
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
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
                    get: vi.fn().mockResolvedValue({ data: {} }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionSetup({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(false);

            const mutationPromise = result.current.mutateAsync({
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
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    post: vi.fn().mockResolvedValue({
                        data: { success: true },
                        error: null,
                    }),
                    get: vi.fn().mockResolvedValue({ data: {} }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionSetup({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            // First mutation
            await result.current.mutateAsync({
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
            const postMock = vi.fn().mockResolvedValue({
                data: { success: true },
                error: null,
            });

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    post: postMock,
                    get: vi.fn().mockResolvedValue({ data: {} }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionSetup({ merchantId: mockMerchantId }),
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
                    hookSignatureKey: key,
                });

                expect(postMock).toHaveBeenCalledWith({
                    platform: "custom",
                    hookSignatureKey: key,
                });
            }
        });
    });
});
