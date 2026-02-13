import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { usePurchaseWebhookStatus } from "./usePurchaseWebhookStatus";

// Mock the backend API
vi.mock("@/api/backendClient", () => ({
    authenticatedBackendApi: {
        merchant: vi.fn((_merchantId: string) => ({
            webhooks: {
                get: vi.fn(),
            },
        })),
    },
}));

// Mock demo mode
vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: vi.fn(() => false),
}));

const mockWebhookSetup = {
    setup: true,
    platform: "shopify" as const,
    webhookSigninKey: "test-signing-key-12345",
    stats: {
        firstPurchase: new Date("2024-01-01"),
        lastPurchase: new Date("2024-01-15"),
        lastUpdate: new Date("2024-01-15T10:30:00"),
        totalPurchaseHandled: 42,
    },
};

const mockWebhookNotSetup = {
    setup: false,
};

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
}

function createWrapper(queryClient: QueryClient) {
    return ({ children }: { children: ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children
        );
}

describe("usePurchaseWebhookStatus", () => {
    it("should return loading state initially", () => {
        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => usePurchaseWebhookStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();
    });

    it("should return webhook status when setup is true", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: mockWebhookSetup,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => usePurchaseWebhookStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBeDefined();
        expect(result.current.data?.setup).toBe(true);
    });

    it("should include platform when webhook is setup", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: mockWebhookSetup,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => usePurchaseWebhookStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        if (result.current.data?.setup) {
            expect(result.current.data.platform).toBe("shopify");
        }
    });

    it("should include webhookSigninKey when webhook is setup", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: mockWebhookSetup,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => usePurchaseWebhookStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        if (result.current.data?.setup) {
            expect(result.current.data.webhookSigninKey).toBe(
                "test-signing-key-12345"
            );
        }
    });

    it("should include stats when webhook is setup", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: mockWebhookSetup,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => usePurchaseWebhookStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        if (result.current.data?.setup) {
            expect(result.current.data.stats).toBeDefined();
            expect(result.current.data.stats?.totalPurchaseHandled).toBe(42);
        }
    });

    it("should return setup false when webhook is not configured", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: mockWebhookNotSetup,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => usePurchaseWebhookStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.setup).toBe(false);
    });

    it("should handle null webhook status response", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: null,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => usePurchaseWebhookStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.setup).toBe(false);
    });

    it("should be disabled when merchantId is empty", () => {
        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => usePurchaseWebhookStatus({ merchantId: "" }),
            { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeUndefined();
    });

    it("should use correct query key", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: mockWebhookSetup,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        renderHook(
            () => usePurchaseWebhookStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        const queries = queryClient.getQueryCache().getAll();
        const webhookQuery = queries.find((q) =>
            q.queryKey.includes("merchant-1")
        );
        expect(webhookQuery?.queryKey).toContain("purchase-webhook-status");
    });

    it("should support different webhook platforms", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");

        const woocommerceWebhook = {
            ...mockWebhookSetup,
            platform: "woocommerce" as const,
        };

        const mockGet = vi.fn().mockResolvedValue({
            data: woocommerceWebhook,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => usePurchaseWebhookStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        if (result.current.data?.setup) {
            expect(result.current.data.platform).toBe("woocommerce");
        }
    });

    it("should handle optional stats in webhook response", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");

        const webhookWithoutStats = {
            setup: true,
            platform: "custom" as const,
            webhookSigninKey: "key-123",
        };

        const mockGet = vi.fn().mockResolvedValue({
            data: webhookWithoutStats,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => usePurchaseWebhookStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        if (result.current.data?.setup) {
            expect(result.current.data.stats).toBeUndefined();
        }
    });
});
