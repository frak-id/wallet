import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useGetMerchantAdministrators } from "./useGetMerchantAdministrators";

// Mock the backend API
vi.mock("@/api/backendClient", () => ({
    authenticatedBackendApi: {
        merchant: vi.fn((_merchantId: string) => ({
            admins: {
                get: vi.fn(),
            },
        })),
    },
}));

// Mock the wallet status hook
vi.mock("@frak-labs/react-sdk", () => ({
    useWalletStatus: vi.fn(() => ({
        data: {
            wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        },
    })),
}));

// Mock demo mode
vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: vi.fn(() => false),
}));

const mockAdminsResponse = {
    admins: [
        {
            id: "admin-1",
            wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
            addedBy: "0x0000000000000000000000000000000000000000" as const,
            addedAt: "2024-01-01T00:00:00.000Z",
            isOwner: true,
        },
        {
            id: "admin-2",
            wallet: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199" as const,
            addedBy: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
            addedAt: "2024-01-15T00:00:00.000Z",
            isOwner: false,
        },
        {
            id: "admin-3",
            wallet: "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1" as const,
            addedBy: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
            addedAt: "2024-01-29T00:00:00.000Z",
            isOwner: false,
        },
    ],
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

describe("useGetMerchantAdministrators", () => {
    it("should return loading state initially", () => {
        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => useGetMerchantAdministrators({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();
    });

    it("should return administrators list on success", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: mockAdminsResponse,
            error: null,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => useGetMerchantAdministrators({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBeDefined();
        expect(result.current.data?.length).toBe(3);
        expect(result.current.data?.[0].id).toBe("admin-1");
    });

    it("should map admin data correctly", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: mockAdminsResponse,
            error: null,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => useGetMerchantAdministrators({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        const admin = result.current.data?.[0];
        expect(admin?.id).toBe("admin-1");
        expect(admin?.wallet).toBe(
            "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
        );
        expect(admin?.isOwner).toBe(true);
    });

    it("should mark current wallet as isMe", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: mockAdminsResponse,
            error: null,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => useGetMerchantAdministrators({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        const currentAdmin = result.current.data?.find(
            (admin) =>
                admin.wallet === "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
        );
        expect(currentAdmin?.isMe).toBe(true);
    });

    it("should mark other wallets as not isMe", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: mockAdminsResponse,
            error: null,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => useGetMerchantAdministrators({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        const otherAdmins = result.current.data?.filter(
            (admin) =>
                admin.wallet !== "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
        );
        otherAdmins?.forEach((admin) => {
            expect(admin.isMe).toBe(false);
        });
    });

    it("should handle API error and return empty array", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: null,
            error: "Failed to fetch admins",
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => useGetMerchantAdministrators({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([]);
    });

    it("should be disabled when merchantId is empty", () => {
        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => useGetMerchantAdministrators({ merchantId: "" }),
            { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeUndefined();
    });

    it("should use correct query key", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: mockAdminsResponse,
            error: null,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: { get: mockGet },
        } as any);

        renderHook(
            () => useGetMerchantAdministrators({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        const queries = queryClient.getQueryCache().getAll();
        const adminQuery = queries.find((q) =>
            q.queryKey.includes("merchant-1")
        );
        expect(adminQuery?.queryKey).toContain("team");
    });

    it("should preserve admin properties in mapped data", async () => {
        const queryClient = createQueryClient();
        const { authenticatedBackendApi } = await import("@/api/backendClient");
        const mockGet = vi.fn().mockResolvedValue({
            data: mockAdminsResponse,
            error: null,
        });

        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            admins: { get: mockGet },
        } as any);

        const { result } = renderHook(
            () => useGetMerchantAdministrators({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        const admin = result.current.data?.[1];
        expect(admin?.addedBy).toBe(
            "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
        );
        expect(admin?.addedAt).toBe("2024-01-15T00:00:00.000Z");
    });
});
