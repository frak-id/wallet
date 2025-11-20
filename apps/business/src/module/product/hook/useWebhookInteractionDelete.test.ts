import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useWebhookInteractionDelete } from "./useWebhookInteractionDelete";

// Mock the business API
vi.mock("@/context/api/backendClient", () => ({
    authenticatedBackendApi: {
        product: vi.fn(() => ({
            interactionsWebhook: {
                delete: {
                    post: vi.fn(),
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

describe("useWebhookInteractionDelete", () => {
    const mockProductId = createMockAddress("product") as Hex;

    describe("successful deletion", () => {
        test("should delete webhook successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const { authenticatedBackendApi } = await import(
                "@/context/api/backendClient"
            );

            const mockResponse = { success: true };

            vi.mocked(authenticatedBackendApi.product).mockReturnValue({
                interactionsWebhook: {
                    delete: {
                        post: vi.fn().mockResolvedValue({
                            data: mockResponse,
                            error: null,
                        }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionDelete({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({ productId: mockProductId });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockResponse);
        });

        test("should call API with correct productId", async ({
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
                    delete: {
                        post: postMock,
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionDelete({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({ productId: mockProductId });

            expect(authenticatedBackendApi.product).toHaveBeenCalledWith({
                productId: mockProductId,
            });
            expect(postMock).toHaveBeenCalled();
        });
    });

    describe("refetch behavior", () => {
        test("should refetch status after successful deletion", async ({
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
                    delete: {
                        post: vi.fn().mockResolvedValue({
                            data: { success: true },
                            error: null,
                        }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionDelete({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({ productId: mockProductId });

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
                    delete: {
                        post: vi.fn().mockResolvedValue({
                            data: null,
                            error: "Deletion failed",
                        }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionDelete({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({ productId: mockProductId })
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
                    delete: {
                        post: vi.fn().mockResolvedValue({
                            data: null,
                            error: "Webhook not found",
                        }),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionDelete({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({ productId: mockProductId })
            ).rejects.toThrow("Webhook not found");
        });

        test("should handle network errors", async ({
            queryWrapper,
        }: TestContext) => {
            const { authenticatedBackendApi } = await import(
                "@/context/api/backendClient"
            );

            vi.mocked(authenticatedBackendApi.product).mockReturnValue({
                interactionsWebhook: {
                    delete: {
                        post: vi
                            .fn()
                            .mockRejectedValue(new Error("Network error")),
                    },
                },
            } as any);

            const { result } = renderHook(
                () => useWebhookInteractionDelete({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({ productId: mockProductId })
            ).rejects.toThrow("Network error");
        });
    });
});
