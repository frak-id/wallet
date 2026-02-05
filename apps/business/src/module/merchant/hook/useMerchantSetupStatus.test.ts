import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useGetMerchantAdministrators } from "./useGetMerchantAdministrators";
import { useGetMerchantBank } from "./useGetMerchantBank";
import { useMerchantSetupStatus } from "./useMerchantSetupStatus";

// Mock dependencies
vi.mock("./useGetMerchantAdministrators");
vi.mock("./useGetMerchantBank");
vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: vi.fn(() => false),
}));

const mockAdministrators = [
    {
        id: "admin-1",
        wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
        addedBy: "0x0000000000000000000000000000000000000000" as const,
        addedAt: "2024-01-01T00:00:00.000Z",
        isOwner: true,
        isMe: false,
    },
    {
        id: "admin-2",
        wallet: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199" as const,
        addedBy: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
        addedAt: "2024-01-15T00:00:00.000Z",
        isOwner: false,
        isMe: false,
    },
];

const mockBankData = {
    deployed: true,
    bankAddress: "0x1111111111111111111111111111111111111111" as const,
    isManager: true,
    isOpen: true,
    tokens: [
        {
            symbol: "eure",
            address: "0x3333333333333333333333333333333333333333" as const,
            balance: 5000000000n,
            allowance: 10000000000n,
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

describe("useMerchantSetupStatus", () => {
    it("should not fetch until dependencies are loaded", () => {
        vi.mocked(useGetMerchantAdministrators).mockReturnValue({
            data: undefined,
            isSuccess: false,
            isLoading: true,
            isError: false,
            error: null,
        } as any);

        vi.mocked(useGetMerchantBank).mockReturnValue({
            data: undefined,
            isSuccess: false,
            isLoading: true,
            isError: false,
            error: null,
        } as any);

        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => useMerchantSetupStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        // Query should be disabled when dependencies are not loaded
        expect(result.current.data).toBeUndefined();
        expect(result.current.isSuccess).toBe(false);
    });

    it("should return setup status items when data is loaded", async () => {
        vi.mocked(useGetMerchantAdministrators).mockReturnValue({
            data: mockAdministrators,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        vi.mocked(useGetMerchantBank).mockReturnValue({
            data: mockBankData,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => useMerchantSetupStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBeDefined();
        expect(result.current.data?.items).toBeDefined();
        expect(result.current.data?.items.length).toBeGreaterThan(0);
    });

    it("should mark other-admin as good when multiple owners exist", async () => {
        // Add a second owner to trigger the "other-admin" check (requires >1 owners)
        const mockWithMultipleOwners = [
            ...mockAdministrators,
            {
                id: "admin-3",
                wallet: "0x9999999999999999999999999999999999999999" as const,
                addedBy: "0x0000000000000000000000000000000000000000" as const,
                addedAt: "2024-02-01T00:00:00.000Z",
                isOwner: true,
                isMe: false,
            },
        ];

        vi.mocked(useGetMerchantAdministrators).mockReturnValue({
            data: mockWithMultipleOwners,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        vi.mocked(useGetMerchantBank).mockReturnValue({
            data: mockBankData,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => useMerchantSetupStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        const otherAdminStep = result.current.data?.items.find(
            (item) => item.key === "other-admin"
        );
        expect(otherAdminStep?.isGood).toBe(true);
    });

    it("should mark add-funding as good when tokens have balance", async () => {
        vi.mocked(useGetMerchantAdministrators).mockReturnValue({
            data: mockAdministrators,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        vi.mocked(useGetMerchantBank).mockReturnValue({
            data: mockBankData,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => useMerchantSetupStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        const fundingStep = result.current.data?.items.find(
            (item) => item.key === "add-funding"
        );
        expect(fundingStep?.isGood).toBe(true);
    });

    it("should mark running-bank as good when bank is open", async () => {
        vi.mocked(useGetMerchantAdministrators).mockReturnValue({
            data: mockAdministrators,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        vi.mocked(useGetMerchantBank).mockReturnValue({
            data: mockBankData,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => useMerchantSetupStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        const bankStep = result.current.data?.items.find(
            (item) => item.key === "running-bank"
        );
        expect(bankStep?.isGood).toBe(true);
    });

    it("should set hasWarning to true when any step is not good", async () => {
        const bankDataWithoutFunding = {
            ...mockBankData,
            tokens: [
                {
                    symbol: "eure",
                    address:
                        "0x3333333333333333333333333333333333333333" as const,
                    balance: 0n,
                    allowance: 0n,
                },
            ],
        };

        vi.mocked(useGetMerchantAdministrators).mockReturnValue({
            data: mockAdministrators,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        vi.mocked(useGetMerchantBank).mockReturnValue({
            data: bankDataWithoutFunding,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => useMerchantSetupStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.hasWarning).toBe(true);
    });

    it("should include all four setup steps", async () => {
        vi.mocked(useGetMerchantAdministrators).mockReturnValue({
            data: mockAdministrators,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        vi.mocked(useGetMerchantBank).mockReturnValue({
            data: mockBankData,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => useMerchantSetupStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        const keys = result.current.data?.items.map((item) => item.key);
        expect(keys).toContain("other-admin");
        expect(keys).toContain("add-funding");
        expect(keys).toContain("running-bank");
        expect(keys).toContain("add-campaign");
    });

    it("should replace merchantId placeholder in resolvingPage", async () => {
        vi.mocked(useGetMerchantAdministrators).mockReturnValue({
            data: mockAdministrators,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        vi.mocked(useGetMerchantBank).mockReturnValue({
            data: mockBankData,
            isSuccess: true,
            isLoading: false,
            isError: false,
            error: null,
        } as any);

        const queryClient = createQueryClient();
        const { result } = renderHook(
            () => useMerchantSetupStatus({ merchantId: "merchant-1" }),
            { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        const items = result.current.data?.items;
        items?.forEach((item) => {
            expect(item.resolvingPage).not.toContain("[merchantId]");
            if (item.key !== "add-campaign") {
                expect(item.resolvingPage).toContain("merchant-1");
            }
        });
    });
});
