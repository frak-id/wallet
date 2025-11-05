/** @jsxImportSource react */
import type {
    HistoryGroup,
    InteractionHistory,
} from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import * as interactionHistoryActions from "@/module/history/action/interactionHistory";
import { useGetInteractionHistory } from "@/module/history/hook/useGetInteractionHistory";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

// Mock wagmi
vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

// Mock the interaction history action
vi.mock("@/module/history/action/interactionHistory", () => ({
    getInteractionHistory: vi.fn(),
}));

describe("useGetInteractionHistory", () => {
    beforeEach(({ queryWrapper }) => {
        vi.clearAllMocks();
        queryWrapper.client.clear();
    });

    const createMockHistoryGroup = (): HistoryGroup<InteractionHistory> => ({
        "2024-01-01": [
            {
                productId: "0x1234567890123456789012345678901234567890",
                productName: "Test Product",
                type: "READ_ARTICLE" as const,
                timestamp: 1704067200000,
                data: {
                    articleId: "article-123",
                },
            },
        ],
        "2024-01-02": [
            {
                productId: "0x1234567890123456789012345678901234567890",
                productName: "Test Product",
                type: "OPEN_ARTICLE" as const,
                timestamp: 1704153600000,
                data: {
                    articleId: "article-456",
                },
            },
        ],
    });

    test("should return initial loading state", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        const { result } = renderHook(() => useGetInteractionHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.history).toBeUndefined();
    });

    test("should fetch interaction history when address is available", async ({
        queryWrapper,
        mockWagmiHooks,
        mockAddress,
    }) => {
        const mockHistory = createMockHistoryGroup();

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        vi.spyOn(
            interactionHistoryActions,
            "getInteractionHistory"
        ).mockResolvedValue(mockHistory);

        const { result } = renderHook(() => useGetInteractionHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        // Wait for query to complete
        await waitFor(() => {
            expect(result.current.history).toBeDefined();
        });

        expect(result.current.history).toEqual(mockHistory);
        expect(
            interactionHistoryActions.getInteractionHistory
        ).toHaveBeenCalledWith({
            account: mockAddress,
        });
    });

    test("should not fetch when address is missing", async ({
        queryWrapper,
    }) => {
        // Mock useAccount to return no address
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: undefined,
            isConnected: false,
            isConnecting: false,
            isDisconnected: true,
        } as any);

        renderHook(() => useGetInteractionHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        // Give it a moment to ensure it doesn't start fetching
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(
            interactionHistoryActions.getInteractionHistory
        ).not.toHaveBeenCalled();
    });

    test("should handle errors gracefully", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const mockError = new Error("Failed to fetch interaction history");

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        vi.spyOn(
            interactionHistoryActions,
            "getInteractionHistory"
        ).mockRejectedValue(mockError);

        const { result } = renderHook(() => useGetInteractionHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        // Wait for error state
        await waitFor(() => {
            expect(result.current.history).toBeUndefined();
        });

        // Query should have been called despite error
        expect(
            interactionHistoryActions.getInteractionHistory
        ).toHaveBeenCalled();
    });

    test("should use correct query key with address", async ({
        queryWrapper,
        mockWagmiHooks,
        mockAddress,
    }) => {
        const mockHistory = createMockHistoryGroup();

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        vi.spyOn(
            interactionHistoryActions,
            "getInteractionHistory"
        ).mockResolvedValue(mockHistory);

        renderHook(() => useGetInteractionHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(
                interactionHistoryActions.getInteractionHistory
            ).toHaveBeenCalled();
        });

        // Verify the query exists in the cache with the correct key
        const queries = queryWrapper.client.getQueryCache().getAll();
        const interactionQuery = queries.find((query) => {
            const key = query.queryKey;
            return (
                key[0] === "history" &&
                key[1] === "interactions" &&
                key[2] === mockAddress
            );
        });

        expect(interactionQuery).toBeDefined();
    });

    test("should return empty history when API returns empty array", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const emptyHistory: HistoryGroup<InteractionHistory> = {};

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        vi.spyOn(
            interactionHistoryActions,
            "getInteractionHistory"
        ).mockResolvedValue(emptyHistory);

        const { result } = renderHook(() => useGetInteractionHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.history).toBeDefined();
        });

        expect(result.current.history).toEqual({});
    });

    test("should handle grouped interactions by date correctly", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const mockHistory: HistoryGroup<InteractionHistory> = {
            "2024-01-01": [
                {
                    productId: "0x1234567890123456789012345678901234567890",
                    productName: "Product A",
                    type: "READ_ARTICLE" as const,
                    timestamp: 1704067200000,
                    data: {
                        articleId: "article-1",
                    },
                },
                {
                    productId: "0x9876543210987654321098765432109876543210",
                    productName: "Product B",
                    type: "OPEN_ARTICLE" as const,
                    timestamp: 1704070800000,
                    data: {
                        articleId: "article-2",
                    },
                },
            ],
            "2024-01-02": [
                {
                    productId: "0x1234567890123456789012345678901234567890",
                    productName: "Product A",
                    type: "REFERRED" as const,
                    timestamp: 1704153600000,
                    data: {
                        referrer:
                            "0x1111111111111111111111111111111111111111" as `0x${string}`,
                    },
                },
            ],
        };

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        vi.spyOn(
            interactionHistoryActions,
            "getInteractionHistory"
        ).mockResolvedValue(mockHistory);

        const { result } = renderHook(() => useGetInteractionHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.history).toBeDefined();
        });

        expect(result.current.history).toEqual(mockHistory);
        expect(Object.keys(result.current.history ?? {})).toHaveLength(2);
        expect(result.current.history?.["2024-01-01"]).toHaveLength(2);
        expect(result.current.history?.["2024-01-02"]).toHaveLength(1);
    });
});
