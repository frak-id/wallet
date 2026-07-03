/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import * as recoveryActions from "@/module/recovery/action/get";
import { useConnectedWalletRecovery } from "@/module/recovery-setup/hook/useConnectedWalletRecovery";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

// Mock wagmi
vi.mock("wagmi", () => ({
    useConnection: vi.fn(),
}));

// Mock recovery actions
vi.mock("@/module/recovery/action/get");

describe("useConnectedWalletRecovery", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should not fetch when address is undefined", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        // Customize mockWagmiHooks for this specific test
        const { useConnection } = await import("wagmi");
        mockWagmiHooks.useConnection.mockReturnValue({
            address: undefined,
            isConnected: false,
            isConnecting: false,
            isDisconnected: true,
        } as unknown as ReturnType<typeof useConnection>);
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );

        const { result } = renderHook(() => useConnectedWalletRecovery(), {
            wrapper: queryWrapper.wrapper,
        });

        // Should not be loading since query is disabled
        expect(result.current.isPending).toBe(true);
        expect(result.current.onChainRecovery).toBeUndefined();
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
            validAfter: 1000,
            validUntil: 2000,
        };

        // Use mockWagmiHooks fixture - already configured with mockAddress
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );

        vi.spyOn(recoveryActions, "getCurrentRecoveryOption").mockResolvedValue(
            mockRecoveryOptions
        );

        const { result } = renderHook(() => useConnectedWalletRecovery(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.onChainRecovery).toEqual(mockRecoveryOptions);
        expect(recoveryActions.getCurrentRecoveryOption).toHaveBeenCalledWith({
            wallet: mockAddress,
        });
    });

    test("should return null when no recovery setup exists", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        // Use mockWagmiHooks fixture - already configured with mockAddress
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );

        vi.spyOn(recoveryActions, "getCurrentRecoveryOption").mockResolvedValue(
            null
        );

        const { result } = renderHook(() => useConnectedWalletRecovery(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.onChainRecovery).toBeNull();
    });

    test("should handle errors gracefully", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const mockError = new Error("Failed to fetch recovery options");

        // Use mockWagmiHooks fixture - already configured with mockAddress
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );

        vi.spyOn(recoveryActions, "getCurrentRecoveryOption").mockRejectedValue(
            mockError
        );

        const { result } = renderHook(() => useConnectedWalletRecovery(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBe(mockError);
    });

    test("should keep data cached across remount to avoid a status flash", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        // Use mockWagmiHooks fixture - already configured with mockAddress
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );

        const mockRecoveryOptions = {
            executor:
                "0x9876543210987654321098765432109876543210" as `0x${string}`,
            guardianAddress:
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
            validAfter: 1000,
            validUntil: 2000,
        };
        const getOption = vi
            .spyOn(recoveryActions, "getCurrentRecoveryOption")
            .mockResolvedValue(mockRecoveryOptions);

        const first = renderHook(() => useConnectedWalletRecovery(), {
            wrapper: queryWrapper.wrapper,
        });
        await waitFor(() => {
            expect(first.result.current.isSuccess).toBe(true);
        });
        expect(getOption).toHaveBeenCalledTimes(1);

        // With gcTime: 0 the cache would be dropped on unmount and the revisit
        // would refetch, flashing "not configured". It must stay cached instead.
        first.unmount();

        const second = renderHook(() => useConnectedWalletRecovery(), {
            wrapper: queryWrapper.wrapper,
        });
        expect(second.result.current.onChainRecovery).toEqual(
            mockRecoveryOptions
        );
        expect(getOption).toHaveBeenCalledTimes(1);
    });
});
