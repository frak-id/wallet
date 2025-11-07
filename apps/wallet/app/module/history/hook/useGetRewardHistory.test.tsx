/** @jsxImportSource react */
import type { HistoryGroup, RewardHistory } from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import * as rewardHistoryActions from "@/module/history/action/rewardHistory";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

// Mock wagmi
vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

// Mock the reward history action
vi.mock("@/module/history/action/rewardHistory", () => ({
    getRewardHistory: vi.fn(),
}));

describe("useGetRewardHistory", () => {
    beforeEach(({ queryWrapper }) => {
        vi.clearAllMocks();
        queryWrapper.client.clear();
    });

    const createMockRewardHistory = (): HistoryGroup<RewardHistory> => ({
        "2024-01-01": [
            {
                type: "add" as const,
                amount: 100.5,
                timestamp: 1704067200,
                txHash: "0xabc123",
                productId: "0x1234567890123456789012345678901234567890",
                productName: "Test Product A",
            },
            {
                type: "claim" as const,
                amount: 50.25,
                timestamp: 1704070800,
                txHash: "0xdef456",
                productId: "0x1234567890123456789012345678901234567890",
                productName: "Test Product A",
            },
        ],
        "2024-01-02": [
            {
                type: "add" as const,
                amount: 200.75,
                timestamp: 1704153600,
                txHash: "0xghi789",
                productId: "0x9876543210987654321098765432109876543210",
                productName: "Test Product B",
            },
        ],
    });

    test("should return initial loading state", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(mockWagmiHooks.useAccount);

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.history).toBeUndefined();
    });

    test("should fetch reward history when address is available", async ({
        queryWrapper,
        mockWagmiHooks,
        mockAddress,
    }) => {
        const mockHistory = createMockRewardHistory();

        // Setup mocks
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(mockWagmiHooks.useAccount);

        vi.spyOn(rewardHistoryActions, "getRewardHistory").mockResolvedValue(
            mockHistory
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        // Wait for query to complete
        await waitFor(() => {
            expect(result.current.history).toBeDefined();
        });

        expect(result.current.history).toEqual(mockHistory);
        expect(rewardHistoryActions.getRewardHistory).toHaveBeenCalledWith({
            account: mockAddress,
        });
    });

    test("should not fetch when address is missing", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        // Mock useAccount to return no address
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            ...mockWagmiHooks.useAccount(),
            address: undefined,
            isConnected: false,
        });

        renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        // Give it a moment to ensure it doesn't start fetching
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(rewardHistoryActions.getRewardHistory).not.toHaveBeenCalled();
    });

    test("should handle errors gracefully", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const mockError = new Error("Failed to fetch reward history");

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(mockWagmiHooks.useAccount);

        vi.spyOn(rewardHistoryActions, "getRewardHistory").mockRejectedValue(
            mockError
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        // Wait for error state
        await waitFor(() => {
            expect(result.current.history).toBeUndefined();
        });

        // Query should have been called despite error
        expect(rewardHistoryActions.getRewardHistory).toHaveBeenCalled();
    });

    test("should use correct query key with address", async ({
        queryWrapper,
        mockWagmiHooks,
        mockAddress,
    }) => {
        const mockHistory = createMockRewardHistory();

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(mockWagmiHooks.useAccount);

        vi.spyOn(rewardHistoryActions, "getRewardHistory").mockResolvedValue(
            mockHistory
        );

        renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(rewardHistoryActions.getRewardHistory).toHaveBeenCalled();
        });

        // Verify the query exists in the cache with the correct key
        const queries = queryWrapper.client.getQueryCache().getAll();
        const rewardQuery = queries.find((query) => {
            const key = query.queryKey;
            return (
                key[0] === "history" &&
                key[1] === "rewards" &&
                key[2] === mockAddress
            );
        });

        expect(rewardQuery).toBeDefined();
    });

    test("should return empty history when API returns empty array", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const emptyHistory: HistoryGroup<RewardHistory> = {};

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(mockWagmiHooks.useAccount);

        vi.spyOn(rewardHistoryActions, "getRewardHistory").mockResolvedValue(
            emptyHistory
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.history).toBeDefined();
        });

        expect(result.current.history).toEqual({});
    });

    test("should handle mixed reward types (add and claim) correctly", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const mockHistory: HistoryGroup<RewardHistory> = {
            "2024-01-01": [
                {
                    type: "add" as const,
                    amount: 100.5,
                    timestamp: 1704067200,
                    txHash: "0xabc123",
                    productId: "0x1234567890123456789012345678901234567890",
                    productName: "Product A",
                },
                {
                    type: "claim" as const,
                    amount: 50.25,
                    timestamp: 1704070800,
                    txHash: "0xdef456",
                    productId: "0x1234567890123456789012345678901234567890",
                    productName: "Product A",
                },
            ],
        };

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(mockWagmiHooks.useAccount);

        vi.spyOn(rewardHistoryActions, "getRewardHistory").mockResolvedValue(
            mockHistory
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.history).toBeDefined();
        });

        expect(result.current.history).toEqual(mockHistory);
        expect(result.current.history?.["2024-01-01"]).toHaveLength(2);
        expect(result.current.history?.["2024-01-01"]?.[0].type).toBe("add");
        expect(result.current.history?.["2024-01-01"]?.[1].type).toBe("claim");
    });

    test("should handle multiple dates with multiple rewards", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const mockHistory: HistoryGroup<RewardHistory> = {
            "2024-01-01": [
                {
                    type: "add" as const,
                    amount: 100,
                    timestamp: 1704067200,
                    txHash: "0x1",
                    productId: "0x1234567890123456789012345678901234567890",
                    productName: "Product A",
                },
            ],
            "2024-01-02": [
                {
                    type: "claim" as const,
                    amount: 50,
                    timestamp: 1704153600,
                    txHash: "0x2",
                    productId: "0x9876543210987654321098765432109876543210",
                    productName: "Product B",
                },
            ],
            "2024-01-03": [
                {
                    type: "add" as const,
                    amount: 200,
                    timestamp: 1704240000,
                    txHash: "0x3",
                    productId: "0x1234567890123456789012345678901234567890",
                    productName: "Product A",
                },
            ],
        };

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(mockWagmiHooks.useAccount);

        vi.spyOn(rewardHistoryActions, "getRewardHistory").mockResolvedValue(
            mockHistory
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.history).toBeDefined();
        });

        expect(result.current.history).toEqual(mockHistory);
        expect(Object.keys(result.current.history ?? {})).toHaveLength(3);
        expect(result.current.history?.["2024-01-01"]).toHaveLength(1);
        expect(result.current.history?.["2024-01-02"]).toHaveLength(1);
        expect(result.current.history?.["2024-01-03"]).toHaveLength(1);
    });
});
