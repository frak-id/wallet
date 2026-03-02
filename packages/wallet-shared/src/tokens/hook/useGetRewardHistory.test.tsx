import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { useGetRewardHistory } from "./useGetRewardHistory";

vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

vi.mock("../../common/api/backendClient", () => ({
    authenticatedWalletApi: {
        rewards: {
            history: {
                get: vi.fn(),
            },
        },
    },
}));

const mockBackendRewards = [
    {
        id: "reward-1",
        amount: 100,
        tokenAddress: "0xabc",
        status: "settled" as const,
        recipientType: "referrer" as const,
        createdAt: "2025-01-15T10:00:00Z",
        settledAt: "2025-01-15T12:00:00Z",
        onchainTxHash: "0xdef",
        trigger: "referral" as const,
        merchant: { name: "Test Merchant", domain: "test.com" },
        token: {
            symbol: "USDC",
            decimals: 6,
            logo: "https://logo.com/usdc.png",
        },
    },
    {
        id: "reward-2",
        amount: 50,
        status: "pending" as const,
        recipientType: "referee" as const,
        createdAt: new Date("2025-01-16T10:00:00Z"),
        merchant: { name: "Other Merchant", domain: "other.com" },
        token: { symbol: "USDC", decimals: 6 },
    },
];

describe("useGetRewardHistory", () => {
    beforeEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test("should return empty rewards when no address is provided", async ({
        queryWrapper,
    }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: undefined,
        } as any);

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.rewards).toEqual([]);
            expect(result.current.total).toBe(0);
            expect(result.current.isLoading).toBe(false);
        });

        expect(
            authenticatedWalletApi.rewards.history.get
        ).not.toHaveBeenCalled();
    });

    test("should fetch and transform rewards when address is present", async ({
        queryWrapper,
    }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            {
                data: { rewards: mockBackendRewards },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.rewards).toHaveLength(2);
            expect(result.current.total).toBe(2);
        });

        // Verify first reward transformation
        const reward1 = result.current.rewards[0];
        expect(reward1.id).toBe("reward-1");
        expect(reward1.amount).toBe(100);
        expect(reward1.txHash).toBe("0xdef");
        expect(reward1.status).toBe("settled");
        expect(reward1.trigger).toBe("referral");
        expect(reward1.recipientType).toBe("referrer");
        expect(reward1.merchant).toEqual({
            name: "Test Merchant",
            domain: "test.com",
        });
        expect(reward1.token).toEqual({
            address: "0xabc",
            symbol: "USDC",
            decimals: 6,
            logo: "https://logo.com/usdc.png",
        });
    });

    test("should convert createdAt string to timestamp", async ({
        queryWrapper,
    }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            {
                data: { rewards: [mockBackendRewards[0]] },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        const expectedTimestamp = new Date("2025-01-15T10:00:00Z").getTime();
        expect(result.current.rewards[0].timestamp).toBe(expectedTimestamp);
    });

    test("should convert createdAt Date object to timestamp", async ({
        queryWrapper,
    }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            {
                data: { rewards: [mockBackendRewards[1]] },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        const expectedTimestamp = new Date("2025-01-16T10:00:00Z").getTime();
        expect(result.current.rewards[0].timestamp).toBe(expectedTimestamp);
    });

    test("should return 0 timestamp for invalid date", async ({
        queryWrapper,
    }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        const invalidDateReward = {
            ...mockBackendRewards[0],
            createdAt: "not-a-date",
        };

        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            {
                data: { rewards: [invalidDateReward] },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.rewards[0].timestamp).toBe(0);
    });

    test("should default trigger to null when undefined", async ({
        queryWrapper,
    }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        // Second mock reward has no trigger
        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            {
                data: { rewards: [mockBackendRewards[1]] },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.rewards[0].trigger).toBeNull();
    });

    test("should default tokenAddress to empty string when undefined", async ({
        queryWrapper,
    }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        // Second mock reward has no tokenAddress
        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            {
                data: { rewards: [mockBackendRewards[1]] },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.rewards[0].token.address).toBe("");
    });

    test("should handle API error", async ({ queryWrapper }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";
        const mockError = new Error("API Error");

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            {
                data: null,
                error: mockError,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.error).toEqual(mockError);
            expect(result.current.rewards).toEqual([]);
        });
    });

    test("should handle null data response", async ({ queryWrapper }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            {
                data: null,
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.rewards).toEqual([]);
            expect(result.current.total).toBe(0);
        });
    });

    test("should handle empty rewards array", async ({ queryWrapper }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            {
                data: { rewards: [] },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.rewards).toEqual([]);
            expect(result.current.total).toBe(0);
        });
    });
});
