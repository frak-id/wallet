import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import * as queryOptions from "../queries/queryOptions";
import { useReadOnlyMerchant } from "./useReadOnlyMerchant";

vi.mock("../queries/queryOptions", () => ({
    merchantQueryOptions: vi.fn(),
}));

vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: vi.fn(() => false),
}));

function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function mockMerchantRole(role: "owner" | "admin" | "platform_admin" | "none") {
    const data = {
        id: "m1",
        domain: "example.com",
        name: "Example",
        ownerWallet: "0x0000000000000000000000000000000000000001" as const,
        bankAddress: null,
        defaultRewardToken: "0x0000000000000000000000000000000000000002" as const,
        explorerConfig: null,
        explorerEnabledAt: null,
        verifiedAt: null,
        createdAt: null,
        allowedDomains: [],
        role,
    };
    vi.mocked(queryOptions.merchantQueryOptions).mockReturnValue({
        queryKey: ["merchant", "m1"],
        queryFn: async () => data,
        enabled: true,
    } as never);
}

describe("useReadOnlyMerchant", () => {
    it("returns false for an owner", async () => {
        mockMerchantRole("owner");
        const { result } = renderHook(
            () => useReadOnlyMerchant({ merchantId: "m1" }),
            { wrapper }
        );
        await waitFor(() => expect(result.current).toBe(false));
    });

    it("returns false for an admin", async () => {
        mockMerchantRole("admin");
        const { result } = renderHook(
            () => useReadOnlyMerchant({ merchantId: "m1" }),
            { wrapper }
        );
        await waitFor(() => expect(result.current).toBe(false));
    });

    it("returns true for a platform_admin", async () => {
        mockMerchantRole("platform_admin");
        const { result } = renderHook(
            () => useReadOnlyMerchant({ merchantId: "m1" }),
            { wrapper }
        );
        await waitFor(() => expect(result.current).toBe(true));
    });

    it("returns false when data is not yet loaded", () => {
        vi.mocked(queryOptions.merchantQueryOptions).mockReturnValue({
            queryKey: ["merchant", "m1"],
            queryFn: () => new Promise(() => {}), // never resolves
            enabled: true,
        } as never);
        const { result } = renderHook(
            () => useReadOnlyMerchant({ merchantId: "m1" }),
            { wrapper }
        );
        // While loading, data is undefined → role is undefined → not read-only
        expect(result.current).toBe(false);
    });
});
