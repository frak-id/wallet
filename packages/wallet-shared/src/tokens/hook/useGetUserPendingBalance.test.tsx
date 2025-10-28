import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { useGetUserPendingBalance } from "./useGetUserPendingBalance";

vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

vi.mock("../../common/api/backendClient", () => ({
    authenticatedWalletApi: {
        balance: {
            pending: {
                get: vi.fn(),
            },
        },
    },
}));

describe("useGetUserPendingBalance", () => {
    let queryClient: QueryClient;
    let wrapper: ({ children }: { children: ReactNode }) => React.ReactElement;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });
        wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
        queryClient.clear();
    });

    it("should return null pending balance when no address is provided", async () => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: undefined,
        } as any);

        const { result } = renderHook(() => useGetUserPendingBalance(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.userPendingBalance).toBeUndefined();
            expect(result.current.isLoading).toBe(false);
        });
    });

    it("should fetch pending balance when address is provided", async () => {
        const mockAddress = "0x1234567890123456789012345678901234567890";
        const mockPendingBalance = {
            pending: "5000000000000000000",
            formatted: "5.0",
        };

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.balance.pending.get).mockResolvedValue(
            {
                data: mockPendingBalance,
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetUserPendingBalance(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.userPendingBalance).toEqual(
                mockPendingBalance
            );
        });

        expect(
            authenticatedWalletApi.balance.pending.get
        ).toHaveBeenCalledTimes(1);
    });

    it("should handle API errors", async () => {
        const mockAddress = "0x1234567890123456789012345678901234567890";
        const mockError = new Error("Pending balance API Error");

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.balance.pending.get).mockResolvedValue(
            {
                data: null,
                error: mockError,
            } as any
        );

        const { result } = renderHook(() => useGetUserPendingBalance(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.error).toEqual(mockError);
            expect(result.current.userPendingBalance).toBeUndefined();
        });
    });

    it("should refetch when refetch is called", async () => {
        const mockAddress = "0x1234567890123456789012345678901234567890";
        const mockBalance1 = { pending: "1000", formatted: "0.001" };
        const mockBalance2 = { pending: "3000", formatted: "0.003" };

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.balance.pending.get)
            .mockResolvedValueOnce({
                data: mockBalance1,
                error: null,
            } as any)
            .mockResolvedValueOnce({
                data: mockBalance2,
                error: null,
            } as any);

        const { result } = renderHook(() => useGetUserPendingBalance(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.userPendingBalance).toEqual(mockBalance1);
        });

        await result.current.refetch();

        await waitFor(() => {
            expect(result.current.userPendingBalance).toEqual(mockBalance2);
        });

        expect(
            authenticatedWalletApi.balance.pending.get
        ).toHaveBeenCalledTimes(2);
    });

    it("should not fetch when address is null", async () => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: null,
        } as any);

        renderHook(() => useGetUserPendingBalance(), { wrapper });

        await waitFor(() => {
            expect(
                authenticatedWalletApi.balance.pending.get
            ).not.toHaveBeenCalled();
        });
    });

    it("should use refetch options for pending balance", async () => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.balance.pending.get).mockResolvedValue(
            {
                data: { pending: "100", formatted: "0.0001" },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetUserPendingBalance(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.refetch).toBeDefined();
        expect(typeof result.current.refetch).toBe("function");
    });
});
