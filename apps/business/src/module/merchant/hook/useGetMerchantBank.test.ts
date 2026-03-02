import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useGetMerchantBank } from "./useGetMerchantBank";

// Mock the backend API
vi.mock("@/api/backendClient", () => ({
    authenticatedBackendApi: {
        merchant: vi.fn((_merchantId: string) => ({
            bank: {
                get: vi.fn(),
            },
        })),
    },
}));

// Mock the blockchain client
vi.mock("@/config/blockchain", () => ({
    viemClient: {},
}));

// Mock viem functions
vi.mock("viem/actions", () => ({
    multicall: vi.fn(),
}));

// Mock demo mode
vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: vi.fn(() => false),
}));

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

describe("useGetMerchantBank", () => {
    it("should return loading state initially", () => {
        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => useGetMerchantBank({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();
    });

    it("should be disabled when merchantId is empty", () => {
        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => useGetMerchantBank({ merchantId: "" }),
            { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeUndefined();
    });

    it("should use correct query key structure", () => {
        const queryClient = createQueryClient();

        renderHook(() => useGetMerchantBank({ merchantId: "merchant-1" }), {
            wrapper: createWrapper(queryClient),
        });

        const queries = queryClient.getQueryCache().getAll();
        const bankQuery = queries.find((q) =>
            q.queryKey.includes("merchant-1")
        );
        expect(bankQuery?.queryKey).toContain("bank");
    });

    it("should include merchantId in query key", () => {
        const queryClient = createQueryClient();

        renderHook(
            () => useGetMerchantBank({ merchantId: "test-merchant-123" }),
            {
                wrapper: createWrapper(queryClient),
            }
        );

        const queries = queryClient.getQueryCache().getAll();
        const bankQuery = queries.find((q) =>
            q.queryKey.includes("test-merchant-123")
        );
        expect(bankQuery).toBeDefined();
    });

    it("should have enabled state based on merchantId", () => {
        const queryClient = createQueryClient();

        const { result: resultWithId } = renderHook(
            () => useGetMerchantBank({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        const { result: resultWithoutId } = renderHook(
            () => useGetMerchantBank({ merchantId: "" }),
            { wrapper: createWrapper(queryClient) }
        );

        // With ID should be loading (enabled)
        expect(resultWithId.current.isLoading).toBe(true);

        // Without ID should not be loading (disabled)
        expect(resultWithoutId.current.isLoading).toBe(false);
    });

    it("should create separate queries for different merchantIds", () => {
        const queryClient = createQueryClient();

        renderHook(() => useGetMerchantBank({ merchantId: "merchant-1" }), {
            wrapper: createWrapper(queryClient),
        });

        renderHook(() => useGetMerchantBank({ merchantId: "merchant-2" }), {
            wrapper: createWrapper(queryClient),
        });

        const queries = queryClient.getQueryCache().getAll();
        const merchant1Query = queries.find((q) =>
            q.queryKey.includes("merchant-1")
        );
        const merchant2Query = queries.find((q) =>
            q.queryKey.includes("merchant-2")
        );

        expect(merchant1Query).toBeDefined();
        expect(merchant2Query).toBeDefined();
        expect(merchant1Query?.queryKey).not.toEqual(merchant2Query?.queryKey);
    });

    it("should have bank in query key", () => {
        const queryClient = createQueryClient();

        renderHook(() => useGetMerchantBank({ merchantId: "merchant-1" }), {
            wrapper: createWrapper(queryClient),
        });

        const queries = queryClient.getQueryCache().getAll();
        const bankQuery = queries.find((q) => q.queryKey.includes("bank"));

        expect(bankQuery).toBeDefined();
        expect(bankQuery?.queryKey).toContain("merchant");
        expect(bankQuery?.queryKey).toContain("bank");
    });
});
