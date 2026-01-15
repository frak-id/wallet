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
import { useWebhookInteractionDelete } from "./useWebhookInteractionDelete";

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

describe("useWebhookInteractionDelete", () => {
    const mockMerchantId = "test-merchant-uuid-123";

    describe("successful deletion", () => {
        test("should delete webhook successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const mockResponse = { success: true };

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    delete: vi.fn().mockResolvedValue({
                        data: mockResponse,
                        error: null,
                    }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionDelete({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync();

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockResponse);
        });

        test("should call API with correct merchantId", async ({
            queryWrapper,
        }: TestContext) => {
            const deleteMock = vi.fn().mockResolvedValue({
                data: { success: true },
                error: null,
            });

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    delete: deleteMock,
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionDelete({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync();

            expect(authenticatedBackendApi.merchant).toHaveBeenCalledWith({
                merchantId: mockMerchantId,
            });
            expect(deleteMock).toHaveBeenCalled();
        });
    });

    describe("refetch behavior", () => {
        test("should refetch status after successful deletion", async ({
            queryWrapper,
        }: TestContext) => {
            const refetchMock = vi.fn();

            vi.mocked(useWebhookInteractionStatus).mockReturnValue({
                refetch: refetchMock,
            } as any);

            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    delete: vi.fn().mockResolvedValue({
                        data: { success: true },
                        error: null,
                    }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionDelete({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync();

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
                    delete: vi.fn().mockResolvedValue({
                        data: null,
                        error: "Deletion failed",
                    }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionDelete({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(result.current.mutateAsync()).rejects.toThrow();

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
                    delete: vi.fn().mockResolvedValue({
                        data: null,
                        error: "Webhook not found",
                    }),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionDelete({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(result.current.mutateAsync()).rejects.toThrow(
                "Webhook not found"
            );
        });

        test("should handle network errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue(
                mockMerchantWebhooks({
                    delete: vi
                        .fn()
                        .mockRejectedValue(new Error("Network error")),
                })
            );

            const { result } = renderHook(
                () =>
                    useWebhookInteractionDelete({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(result.current.mutateAsync()).rejects.toThrow(
                "Network error"
            );
        });
    });
});
