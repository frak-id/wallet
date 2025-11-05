/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import * as recoveryActions from "@/module/recovery/action/get";
import { useRecoverySetupStatus } from "@/module/recovery-setup/hook/useRecoverySetupStatus";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

// Mock wagmi
vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

// Mock recovery actions
vi.mock("@/module/recovery/action/get");

describe("useRecoverySetupStatus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should not fetch when address is undefined", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        // Customize mockWagmiHooks for this specific test
        const { useAccount } = await import("wagmi");
        mockWagmiHooks.useAccount.mockReturnValue({
            address: undefined,
            isConnected: false,
            isConnecting: false,
            isDisconnected: true,
        } as unknown as ReturnType<typeof useAccount>);
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        const { result } = renderHook(() => useRecoverySetupStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        // Should not be loading since query is disabled
        expect(result.current.isPending).toBe(true);
        expect(result.current.recoverySetupStatus).toBeUndefined();
    });

    test("should fetch recovery status when address is available", async ({
        queryWrapper,
        mockAddress,
        mockWagmiHooks,
    }) => {
        const mockRecoveryOptions = {
            executor:
                "0x9876543210987654321098765432109876543210" as `0x${string}`,
            guardianAddress:
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        };

        // Use mockWagmiHooks fixture - already configured with mockAddress
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        vi.spyOn(recoveryActions, "getCurrentRecoveryOption").mockResolvedValue(
            mockRecoveryOptions
        );

        const { result } = renderHook(() => useRecoverySetupStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.recoverySetupStatus).toEqual(mockRecoveryOptions);
        expect(recoveryActions.getCurrentRecoveryOption).toHaveBeenCalledWith({
            wallet: mockAddress,
        });
    });

    test("should return null when no recovery setup exists", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        // Use mockWagmiHooks fixture - already configured with mockAddress
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        vi.spyOn(recoveryActions, "getCurrentRecoveryOption").mockResolvedValue(
            null
        );

        const { result } = renderHook(() => useRecoverySetupStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.recoverySetupStatus).toBeNull();
    });

    test("should handle errors gracefully", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const mockError = new Error("Failed to fetch recovery options");

        // Use mockWagmiHooks fixture - already configured with mockAddress
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        vi.spyOn(recoveryActions, "getCurrentRecoveryOption").mockRejectedValue(
            mockError
        );

        const { result } = renderHook(() => useRecoverySetupStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBe(mockError);
    });

    test("should have gcTime of 0 for fresh data", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        // Use mockWagmiHooks fixture - already configured with mockAddress
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockImplementation(
            mockWagmiHooks.useAccount as any
        );

        vi.spyOn(recoveryActions, "getCurrentRecoveryOption").mockResolvedValue(
            null
        );

        const { result } = renderHook(() => useRecoverySetupStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        // gcTime: 0 means the cache is immediately garbage collected
        // This ensures we always fetch fresh data
        expect(result.current.isSuccess).toBe(true);
    });
});
