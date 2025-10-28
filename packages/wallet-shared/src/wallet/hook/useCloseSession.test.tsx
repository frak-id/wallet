import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import type { ReactNode } from "react";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCloseSession } from "./useCloseSession";

vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
    useSendTransaction: vi.fn(),
}));

vi.mock("../../common/analytics", () => ({
    trackGenericEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../interaction/utils/getEnableDisableData", () => ({
    getDisableSessionData: vi.fn(),
}));

describe("useCloseSession", () => {
    let queryClient: QueryClient;
    let wrapper: ({ children }: { children: ReactNode }) => React.ReactElement;
    const mockAddress: Address = "0x1234567890123456789012345678901234567890";
    const mockTxHash: Address = "0xabcdef1234567890abcdef1234567890abcdef12";

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
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

    it("should not execute when no address is provided", async () => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { getDisableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );

        const sendTransactionAsync = vi.fn();

        vi.mocked(useAccount).mockReturnValue({ address: undefined } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);

        const { result } = renderHook(() => useCloseSession(), { wrapper });

        await result.current.mutateAsync();

        expect(result.current.data).toBeUndefined();
        expect(sendTransactionAsync).not.toHaveBeenCalled();
        expect(getDisableSessionData).not.toHaveBeenCalled();
    });

    it("should close session successfully", async () => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { getDisableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );
        const { trackGenericEvent } = await import("../../common/analytics");

        const mockDisableData: Address =
            "0xdisabledata1234567890abcdef1234567890abcd";
        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);
        vi.mocked(getDisableSessionData).mockReturnValue(mockDisableData);

        const { result } = renderHook(() => useCloseSession(), { wrapper });

        await result.current.mutateAsync();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBe(mockTxHash);
        expect(getDisableSessionData).toHaveBeenCalledWith({
            wallet: mockAddress,
        });
        expect(sendTransactionAsync).toHaveBeenCalledWith({
            to: mockAddress,
            data: mockDisableData,
        });
        expect(trackGenericEvent).toHaveBeenCalledWith(
            "close-session_initiated"
        );
        expect(trackGenericEvent).toHaveBeenCalledWith(
            "close-session_completed"
        );
    });

    it("should invalidate session status queries after closing", async () => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { getDisableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );

        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);
        const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);
        vi.mocked(getDisableSessionData).mockReturnValue(
            "0xdisabledata" as Address
        );

        const { result } = renderHook(() => useCloseSession(), { wrapper });

        await result.current.mutateAsync();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(invalidateQueries).toHaveBeenCalled();
    });

    it("should handle transaction errors", async () => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { getDisableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );

        const mockError = new Error("Transaction failed");
        const sendTransactionAsync = vi.fn().mockRejectedValue(mockError);

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);
        vi.mocked(getDisableSessionData).mockReturnValue(
            "0xdisabledata" as Address
        );

        const { result } = renderHook(() => useCloseSession(), { wrapper });

        await expect(result.current.mutateAsync()).rejects.toThrow(
            "Transaction failed"
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(mockError);
    });

    it("should log transaction hash", async () => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { getDisableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});
        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);
        vi.mocked(getDisableSessionData).mockReturnValue(
            "0xdisabledata" as Address
        );

        const { result } = renderHook(() => useCloseSession(), { wrapper });

        await result.current.mutateAsync();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(consoleLogSpy).toHaveBeenCalledWith(
            `Close session tx hash: ${mockTxHash}`
        );

        consoleLogSpy.mockRestore();
    });
});
