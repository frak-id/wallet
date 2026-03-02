import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { keccak256, toHex } from "viem";
import { describe, expect, it, vi } from "vitest";
import * as queryOptions from "../queries/queryOptions";
import { computeProductId, useMerchant } from "./useMerchant";

// Mock the query options
vi.mock("../queries/queryOptions", () => ({
    merchantQueryOptions: vi.fn(),
}));

// Mock the demo mode hook
vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: vi.fn(() => false),
}));

const mockMerchantData = {
    id: "merchant-1",
    domain: "example.com",
    name: "Example Merchant",
    ownerWallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
    bankAddress: "0x1111111111111111111111111111111111111111" as const,
    defaultRewardToken: "0x2222222222222222222222222222222222222222" as const,
    config: null,
    verifiedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    role: "owner" as const,
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

describe("computeProductId", () => {
    it("should compute productId from domain", () => {
        const domain = "example.com";
        const productId = computeProductId(domain);

        const expectedProductId = keccak256(toHex("example.com"));
        expect(productId).toBe(expectedProductId);
    });

    it("should remove www prefix before computing hash", () => {
        const domain = "www.example.com";
        const productId = computeProductId(domain);

        const expectedProductId = keccak256(toHex("example.com"));
        expect(productId).toBe(expectedProductId);
    });

    it("should return valid Hex format", () => {
        const productId = computeProductId("test.com");
        expect(productId).toMatch(/^0x[a-f0-9]{64}$/i);
    });
});

describe("useMerchant", () => {
    it("should return loading state initially", () => {
        const queryClient = createQueryClient();
        vi.mocked(queryOptions.merchantQueryOptions).mockReturnValue({
            queryKey: ["merchant", "merchant-1", "live"],
            queryFn: async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
                return mockMerchantData;
            },
        } as any);

        const { result } = renderHook(
            () => useMerchant({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();
    });

    it("should return merchant data with computed productId on success", async () => {
        const queryClient = createQueryClient();
        vi.mocked(queryOptions.merchantQueryOptions).mockReturnValue({
            queryKey: ["merchant", "merchant-1", "live"],
            queryFn: async () => mockMerchantData,
        } as any);

        const { result } = renderHook(
            () => useMerchant({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBeDefined();
        expect(result.current.data?.id).toBe("merchant-1");
        expect(result.current.data?.domain).toBe("example.com");
        expect(result.current.data?.productId).toBe(
            computeProductId("example.com")
        );
    });

    it("should compute productId from domain in returned data", async () => {
        const queryClient = createQueryClient();
        const expectedProductId = keccak256(toHex("example.com"));

        vi.mocked(queryOptions.merchantQueryOptions).mockReturnValue({
            queryKey: ["merchant", "merchant-1", "live"],
            queryFn: async () => mockMerchantData,
        } as any);

        const { result } = renderHook(
            () => useMerchant({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.productId).toBe(expectedProductId);
    });

    it("should return undefined productId when data is undefined", async () => {
        const queryClient = createQueryClient();
        vi.mocked(queryOptions.merchantQueryOptions).mockReturnValue({
            queryKey: ["merchant", "merchant-1", "live"],
            queryFn: async () => {
                throw new Error("Failed to fetch");
            },
        } as any);

        const { result } = renderHook(
            () => useMerchant({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.data).toBeUndefined();
    });

    it("should handle error state", async () => {
        const queryClient = createQueryClient();
        const error = new Error("Failed to fetch merchant");

        vi.mocked(queryOptions.merchantQueryOptions).mockReturnValue({
            queryKey: ["merchant", "merchant-1", "live"],
            queryFn: async () => {
                throw error;
            },
        } as any);

        const { result } = renderHook(
            () => useMerchant({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
    });

    it("should pass merchantId to merchantQueryOptions", () => {
        const queryClient = createQueryClient();
        vi.mocked(queryOptions.merchantQueryOptions).mockReturnValue({
            queryKey: ["merchant", "merchant-1", "live"],
            queryFn: async () => mockMerchantData,
        } as any);

        renderHook(() => useMerchant({ merchantId: "merchant-1" }), {
            wrapper: createWrapper(queryClient),
        });

        expect(queryOptions.merchantQueryOptions).toHaveBeenCalled();
    });
});
