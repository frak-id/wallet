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

const mockBackendItems = [
    {
        merchant: { name: "Test Merchant", domain: "test.com" },
        token: { symbol: "USDC", decimals: 6 },
        amount: {
            amount: 100,
            eurAmount: 90,
            usdAmount: 100,
            gbpAmount: 78,
        },
        status: "settled" as const,
        role: "referrer" as const,
        trigger: "referral" as const,
        txHash: "0xdef",
        createdAt: "2025-01-15T10:00:00Z",
        settledAt: "2025-01-15T12:00:00Z",
    },
    {
        merchant: { name: "Other Merchant", domain: "other.com" },
        token: { symbol: "USDC", decimals: 6 },
        amount: {
            amount: 50,
            eurAmount: 45,
            usdAmount: 50,
            gbpAmount: 39,
        },
        status: "pending" as const,
        role: "referee" as const,
        trigger: "purchase" as const,
        createdAt: new Date("2025-01-16T10:00:00Z"),
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
            expect(result.current.items).toEqual([]);
            expect(result.current.totalCount).toBe(0);
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
                data: { items: mockBackendItems, totalCount: 2 },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.items).toHaveLength(2);
            expect(result.current.totalCount).toBe(2);
        });

        const item1 = result.current.items[0];
        expect(item1.merchant).toEqual({
            name: "Test Merchant",
            domain: "test.com",
        });
        expect(item1.token).toEqual({
            symbol: "USDC",
            decimals: 6,
        });
        expect(item1.amount.amount).toBe(100);
        expect(item1.role).toBe("referrer");
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
                data: { items: [mockBackendItems[0]], totalCount: 1 },
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
        expect(result.current.items[0].createdAt).toBe(expectedTimestamp);
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
                data: { items: [mockBackendItems[1]], totalCount: 1 },
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
        expect(result.current.items[0].createdAt).toBe(expectedTimestamp);
    });

    test("should return 0 timestamp for invalid date", async ({
        queryWrapper,
    }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        const invalidDateItem = {
            ...mockBackendItems[0],
            createdAt: "not-a-date",
        };

        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            {
                data: { items: [invalidDateItem], totalCount: 1 },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.items[0].createdAt).toBe(0);
    });

    test("should handle referee role", async ({ queryWrapper }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            {
                data: { items: [mockBackendItems[1]], totalCount: 1 },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.items[0].role).toBe("referee");
    });

    test("should handle referrer role", async ({ queryWrapper }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            {
                data: { items: [mockBackendItems[0]], totalCount: 1 },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.items[0].role).toBe("referrer");
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
            expect(result.current.items).toEqual([]);
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
            expect(result.current.items).toEqual([]);
            expect(result.current.totalCount).toBe(0);
        });
    });

    test("should handle empty items array", async ({ queryWrapper }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            {
                data: { items: [], totalCount: 0 },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.items).toEqual([]);
            expect(result.current.totalCount).toBe(0);
        });
    });
});
