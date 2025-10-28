import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import type { ReactNode } from "react";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InteractionSession } from "../../types/Session";
import { useInteractionSessionStatus } from "./useInteractionSessionStatus";

vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

vi.mock("../../interaction/action/interactionSession", () => ({
    getSessionStatus: vi.fn(),
}));

vi.mock("../../stores/walletStore", () => ({
    walletStore: {
        getState: vi.fn(),
    },
}));

describe("useInteractionSessionStatus", () => {
    let queryClient: QueryClient;
    let wrapper: ({ children }: { children: ReactNode }) => React.ReactElement;
    const mockAddress: Address = "0x1234567890123456789012345678901234567890";

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
        wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
        queryClient.clear();
    });

    it("should not fetch when no address is provided", async () => {
        const { useAccount } = await import("wagmi");

        vi.mocked(useAccount).mockReturnValue({ address: undefined } as any);

        const { result } = renderHook(() => useInteractionSessionStatus(), {
            wrapper,
        });

        expect(result.current.data).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.fetchStatus).toBe("idle");
    });

    it("should use wagmi address when no param address is provided", async () => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const mockSession: InteractionSession = {
            sessionStart: Date.now(),
            sessionEnd: Date.now() + 3600000,
        };

        const setInteractionSession = vi.fn();

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockResolvedValue(mockSession);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession,
        } as any);

        const { result } = renderHook(() => useInteractionSessionStatus(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockSession);
        expect(getSessionStatus).toHaveBeenCalledWith({
            wallet: mockAddress,
        });
        expect(setInteractionSession).toHaveBeenCalledWith(mockSession);
    });

    it("should use param address over wagmi address", async () => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const differentAddress: Address =
            "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
        const mockSession: InteractionSession = {
            sessionStart: Date.now() - 3600000,
            sessionEnd: Date.now(),
        };

        const setInteractionSession = vi.fn();

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockResolvedValue(mockSession);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession,
        } as any);

        const { result } = renderHook(
            () => useInteractionSessionStatus({ address: differentAddress }),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockSession);
        expect(getSessionStatus).toHaveBeenCalledWith({
            wallet: differentAddress,
        });
    });

    it("should return null when session status is null", async () => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const setInteractionSession = vi.fn();

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockResolvedValue(null);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession,
        } as any);

        const { result } = renderHook(() => useInteractionSessionStatus(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBeNull();
        expect(setInteractionSession).toHaveBeenCalledWith(null);
    });

    it("should update wallet store with session status", async () => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const mockSession: InteractionSession = {
            sessionStart: Date.now(),
            sessionEnd: Date.now() + 3600000,
        };

        const setInteractionSession = vi.fn();

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockResolvedValue(mockSession);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession,
        } as any);

        const { result } = renderHook(() => useInteractionSessionStatus(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(setInteractionSession).toHaveBeenCalledTimes(1);
        expect(setInteractionSession).toHaveBeenCalledWith(mockSession);
    });

    it("should respect custom query options", async () => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const mockSession: InteractionSession = {
            sessionStart: Date.now(),
            sessionEnd: Date.now() + 3600000,
        };

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockResolvedValue(mockSession);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession: vi.fn(),
        } as any);

        const { result } = renderHook(
            () =>
                useInteractionSessionStatus({
                    query: {
                        staleTime: 10000,
                        gcTime: 20000,
                    },
                }),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockSession);
    });

    it("should refetch session status when refetch is called", async () => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const mockSession1: InteractionSession = {
            sessionStart: Date.now(),
            sessionEnd: Date.now() + 3600000,
        };

        const mockSession2: InteractionSession = {
            sessionStart: Date.now(),
            sessionEnd: Date.now(),
        };

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus)
            .mockResolvedValueOnce(mockSession1)
            .mockResolvedValueOnce(mockSession2);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession: vi.fn(),
        } as any);

        const { result } = renderHook(() => useInteractionSessionStatus(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.sessionEnd).toBeGreaterThan(Date.now());

        await result.current.refetch();

        await waitFor(() => {
            expect(result.current.data?.sessionEnd).toBeLessThanOrEqual(
                Date.now()
            );
        });

        expect(getSessionStatus).toHaveBeenCalledTimes(2);
    });

    it("should handle errors from getSessionStatus", async () => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const mockError = new Error("Failed to fetch session status");

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockRejectedValue(mockError);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession: vi.fn(),
        } as any);

        const { result } = renderHook(() => useInteractionSessionStatus(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(mockError);
    });

    it("should be disabled when address changes from defined to undefined", async () => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const mockSession: InteractionSession = {
            sessionStart: Date.now(),
            sessionEnd: Date.now() + 3600000,
        };

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockResolvedValue(mockSession);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession: vi.fn(),
        } as any);

        const { result, rerender } = renderHook(
            () => useInteractionSessionStatus(),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        // Change address to undefined
        vi.mocked(useAccount).mockReturnValue({ address: undefined } as any);
        rerender();

        expect(result.current.fetchStatus).toBe("idle");
    });
});
