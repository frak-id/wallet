/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

// Mock wagmi
vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

// Mock backend client used by wallet-shared
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

    const mockReward = {
        id: "reward-1",
        amount: 12.5,
        tokenAddress: "0x1111111111111111111111111111111111111111",
        status: "pending" as const,
        recipientType: "referee" as const,
        createdAt: new Date("2026-01-20T10:00:00.000Z"),
        settledAt: undefined,
        onchainTxHash: "0xabc123",
        trigger: "purchase" as const,
        merchant: {
            name: "Frak",
            domain: "frak.id",
        },
        token: {
            symbol: "USDC",
            decimals: 6,
            logo: undefined,
        },
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
            createSuccessResponse({ rewards: [mockReward] })
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isLoading).toBe(true);
        expect(result.current.rewards).toEqual([]);
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
            createSuccessResponse({ rewards: [mockReward] })
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.rewards).toBeDefined();
        expect(Array.isArray(result.current.rewards)).toBe(true);
        expect(result.current.rewards[0]?.timestamp).toBe(
            mockReward.createdAt.getTime()
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

        expect(result.current.rewards).toEqual([]);
        expect(
            authenticatedWalletApi.rewards.history.get
        ).not.toHaveBeenCalled();
    });

    test("should return correct reward structure", async ({
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
            createSuccessResponse({ rewards: [mockReward] })
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        if (result.current.rewards.length > 0) {
            const reward = result.current.rewards[0];
            expect(reward).toHaveProperty("id");
            expect(reward).toHaveProperty("amount");
            expect(reward).toHaveProperty("timestamp");
            expect(reward).toHaveProperty("status");
            expect(reward).toHaveProperty("trigger");
            expect(reward).toHaveProperty("merchant");
            expect(reward).toHaveProperty("token");
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
            createSuccessResponse({ rewards: [mockReward] })
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.total).toBe(1);
    });
});
