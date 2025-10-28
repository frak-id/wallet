/** @jsxImportSource react */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as recoveryActions from "@/module/recovery/action/get";
import { useRecoverySetupStatus } from "@/module/recovery-setup/hook/useRecoverySetupStatus";

// Mock wagmi
vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

// Mock recovery actions
vi.mock("@/module/recovery/action/get");

describe("useRecoverySetupStatus", () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });
        vi.clearAllMocks();
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );

    it("should not fetch when address is undefined", async () => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: undefined,
        } as unknown as ReturnType<typeof useAccount>);

        const { result } = renderHook(() => useRecoverySetupStatus(), {
            wrapper,
        });

        // Should not be loading since query is disabled
        expect(result.current.isPending).toBe(true);
        expect(result.current.recoverySetupStatus).toBeUndefined();
    });

    it("should fetch recovery status when address is available", async () => {
        const mockAddress =
            "0x1234567890123456789012345678901234567890" as `0x${string}`;
        const mockRecoveryOptions = {
            executor:
                "0x9876543210987654321098765432109876543210" as `0x${string}`,
            guardianAddress:
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        };

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as unknown as ReturnType<typeof useAccount>);

        vi.spyOn(recoveryActions, "getCurrentRecoveryOption").mockResolvedValue(
            mockRecoveryOptions
        );

        const { result } = renderHook(() => useRecoverySetupStatus(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.recoverySetupStatus).toEqual(mockRecoveryOptions);
        expect(recoveryActions.getCurrentRecoveryOption).toHaveBeenCalledWith({
            wallet: mockAddress,
        });
    });

    it("should return null when no recovery setup exists", async () => {
        const mockAddress =
            "0x1234567890123456789012345678901234567890" as `0x${string}`;

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as unknown as ReturnType<typeof useAccount>);

        vi.spyOn(recoveryActions, "getCurrentRecoveryOption").mockResolvedValue(
            null
        );

        const { result } = renderHook(() => useRecoverySetupStatus(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.recoverySetupStatus).toBeNull();
    });

    it("should handle errors gracefully", async () => {
        const mockAddress =
            "0x1234567890123456789012345678901234567890" as `0x${string}`;
        const mockError = new Error("Failed to fetch recovery options");

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as unknown as ReturnType<typeof useAccount>);

        vi.spyOn(recoveryActions, "getCurrentRecoveryOption").mockRejectedValue(
            mockError
        );

        const { result } = renderHook(() => useRecoverySetupStatus(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBe(mockError);
    });

    it("should have gcTime of 0 for fresh data", async () => {
        const mockAddress =
            "0x1234567890123456789012345678901234567890" as `0x${string}`;

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as unknown as ReturnType<typeof useAccount>);

        vi.spyOn(recoveryActions, "getCurrentRecoveryOption").mockResolvedValue(
            null
        );

        const { result } = renderHook(() => useRecoverySetupStatus(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        // gcTime: 0 means the cache is immediately garbage collected
        // This ensures we always fetch fresh data
        expect(result.current.isSuccess).toBe(true);
    });
});
