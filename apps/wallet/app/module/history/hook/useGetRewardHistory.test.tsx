/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

// Mock wagmi
vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

describe("useGetRewardHistory", () => {
    beforeEach(({ queryWrapper }) => {
        vi.clearAllMocks();
        queryWrapper.client.clear();
    });

    test("should return initial loading state", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
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

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.rewards).toBeDefined();
        expect(Array.isArray(result.current.rewards)).toBe(true);
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

        expect(result.current.rewards).toEqual([]);
    });

    test("should return correct reward structure", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
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

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.total).toBeGreaterThanOrEqual(0);
    });
});
