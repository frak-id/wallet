/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
    authenticatedWalletApi: {
        rewards: {
            history: {
                get: vi.fn(),
            },
        },
    },
}));

describe("useGetRewardHistory", () => {
    beforeEach(({ queryWrapper }) => {
        vi.clearAllMocks();
        queryWrapper.client.clear();
    });

    function createSuccessResponse<T>(data: T) {
        return {
            data,
            error: null,
            response: new Response(),
            status: 200,
            headers: new Headers(),
        };
    }

    const mockItem = {
        merchant: {
            name: "Frak",
            domain: "frak.id",
        },
        token: {
            symbol: "USDC",
            decimals: 6,
        },
        amount: {
            amount: 12.5,
            eurAmount: 11.25,
            usdAmount: 12.5,
            gbpAmount: 9.75,
        },
        status: "pending" as const,
        role: "referee" as const,
        trigger: "purchase" as const,
        txHash: "0xabc123",
        createdAt: new Date("2026-01-20T10:00:00.000Z"),
    };

    test("should return initial loading state", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared/common/api/backendClient"
        );
        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            createSuccessResponse({ items: [mockItem], totalCount: 1 })
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isLoading).toBe(true);
        expect(result.current.items).toEqual([]);
    });

    test("should return rewards when data is available", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared/common/api/backendClient"
        );
        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            createSuccessResponse({ items: [mockItem], totalCount: 1 })
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.items).toBeDefined();
        expect(Array.isArray(result.current.items)).toBe(true);
        expect(result.current.items[0]?.createdAt).toBe(
            mockItem.createdAt.getTime()
        );
    });

    test("should not fetch when address is missing", async ({
        queryWrapper,
    }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: undefined,
            isConnected: false,
            isConnecting: false,
            isDisconnected: true,
        } as any);

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared/common/api/backendClient"
        );

        expect(result.current.items).toEqual([]);
        expect(
            authenticatedWalletApi.rewards.history.get
        ).not.toHaveBeenCalled();
    });

    test("should return correct flat reward structure", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared/common/api/backendClient"
        );
        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            createSuccessResponse({ items: [mockItem], totalCount: 1 })
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        if (result.current.items.length > 0) {
            const item = result.current.items[0];
            expect(item).toHaveProperty("amount");
            expect(item).toHaveProperty("createdAt");
            expect(item).toHaveProperty("merchant");
            expect(item).toHaveProperty("token");
            expect(item).toHaveProperty("status");
            expect(item).toHaveProperty("role");
            expect(item).toHaveProperty("trigger");
        }
    });

    test("should return total count", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared/common/api/backendClient"
        );
        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            createSuccessResponse({ items: [mockItem], totalCount: 1 })
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.totalCount).toBe(1);
    });
});
