import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import type { ReactNode } from "react";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOpenSession } from "./useOpenSession";

vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
    useSendTransaction: vi.fn(),
}));

vi.mock("../../common/analytics", () => ({
    trackGenericEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../interaction/utils/getEnableDisableData", () => ({
    getEnableSessionData: vi.fn(),
}));

vi.mock("./useConsumePendingInteractions", () => ({
    useConsumePendingInteractions: vi.fn(),
}));

describe("useOpenSession", () => {
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
        const { useConsumePendingInteractions } = await import(
            "./useConsumePendingInteractions"
        );
        const { getEnableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );

        const sendTransactionAsync = vi.fn();
        const consumePendingInteractions = vi.fn();

        vi.mocked(useAccount).mockReturnValue({ address: undefined } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);
        vi.mocked(useConsumePendingInteractions).mockReturnValue({
            mutateAsync: consumePendingInteractions,
        } as any);

        const { result } = renderHook(() => useOpenSession(), { wrapper });

        await result.current.mutateAsync();

        expect(result.current.data).toBeUndefined();
        expect(sendTransactionAsync).not.toHaveBeenCalled();
        expect(consumePendingInteractions).not.toHaveBeenCalled();
        expect(getEnableSessionData).not.toHaveBeenCalled();
    });

    it("should open session successfully", async () => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { useConsumePendingInteractions } = await import(
            "./useConsumePendingInteractions"
        );
        const { getEnableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );
        const { trackGenericEvent } = await import("../../common/analytics");

        const mockEnableData: Address =
            "0xenabledata1234567890abcdef1234567890abcdef";
        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);
        const consumePendingInteractions = vi.fn().mockResolvedValue({});

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);
        vi.mocked(useConsumePendingInteractions).mockReturnValue({
            mutateAsync: consumePendingInteractions,
        } as any);
        vi.mocked(getEnableSessionData).mockReturnValue(mockEnableData);

        const { result } = renderHook(() => useOpenSession(), { wrapper });

        await result.current.mutateAsync();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual({
            openSessionTxHash: mockTxHash,
        });
        expect(getEnableSessionData).toHaveBeenCalledWith(
            expect.objectContaining({
                wallet: mockAddress,
                sessionEnd: expect.any(Date),
            })
        );
        expect(sendTransactionAsync).toHaveBeenCalledWith({
            to: mockAddress,
            data: mockEnableData,
        });
        expect(consumePendingInteractions).toHaveBeenCalled();
        expect(trackGenericEvent).toHaveBeenCalledWith(
            "open-session_initiated"
        );
        expect(trackGenericEvent).toHaveBeenCalledWith(
            "open-session_completed"
        );
    });

    it("should set session end to 30 days in the future", async () => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { useConsumePendingInteractions } = await import(
            "./useConsumePendingInteractions"
        );
        const { getEnableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );

        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);
        const consumePendingInteractions = vi.fn().mockResolvedValue({});

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);
        vi.mocked(useConsumePendingInteractions).mockReturnValue({
            mutateAsync: consumePendingInteractions,
        } as any);
        vi.mocked(getEnableSessionData).mockReturnValue(
            "0xenabledata" as Address
        );

        const { result } = renderHook(() => useOpenSession(), { wrapper });

        await result.current.mutateAsync();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(getEnableSessionData).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionEnd: expect.any(Date),
            })
        );

        const callArgs = vi.mocked(getEnableSessionData).mock.calls[0][0];
        const sessionEnd = callArgs.sessionEnd as Date;
        const expectedEnd = new Date();
        expectedEnd.setDate(expectedEnd.getDate() + 30);

        // Check that sessionEnd is approximately 30 days from now (within 1 minute tolerance)
        const timeDiff = Math.abs(sessionEnd.getTime() - expectedEnd.getTime());
        expect(timeDiff).toBeLessThan(60000); // 1 minute in milliseconds
    });

    it("should invalidate session status queries after opening", async () => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { useConsumePendingInteractions } = await import(
            "./useConsumePendingInteractions"
        );
        const { getEnableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );

        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);
        const consumePendingInteractions = vi.fn().mockResolvedValue({});
        const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);
        vi.mocked(useConsumePendingInteractions).mockReturnValue({
            mutateAsync: consumePendingInteractions,
        } as any);
        vi.mocked(getEnableSessionData).mockReturnValue(
            "0xenabledata" as Address
        );

        const { result } = renderHook(() => useOpenSession(), { wrapper });

        await result.current.mutateAsync();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(invalidateQueries).toHaveBeenCalled();
    });

    it("should handle transaction errors", async () => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { useConsumePendingInteractions } = await import(
            "./useConsumePendingInteractions"
        );
        const { getEnableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );

        const mockError = new Error("Transaction failed");
        const sendTransactionAsync = vi.fn().mockRejectedValue(mockError);
        const consumePendingInteractions = vi.fn().mockResolvedValue({});

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);
        vi.mocked(useConsumePendingInteractions).mockReturnValue({
            mutateAsync: consumePendingInteractions,
        } as any);
        vi.mocked(getEnableSessionData).mockReturnValue(
            "0xenabledata" as Address
        );

        const { result } = renderHook(() => useOpenSession(), { wrapper });

        await expect(result.current.mutateAsync()).rejects.toThrow(
            "Transaction failed"
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(mockError);
    });

    it("should handle consume pending interactions errors", async () => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { useConsumePendingInteractions } = await import(
            "./useConsumePendingInteractions"
        );
        const { getEnableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );

        const mockError = new Error("Failed to consume interactions");
        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);
        const consumePendingInteractions = vi.fn().mockRejectedValue(mockError);

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);
        vi.mocked(useConsumePendingInteractions).mockReturnValue({
            mutateAsync: consumePendingInteractions,
        } as any);
        vi.mocked(getEnableSessionData).mockReturnValue(
            "0xenabledata" as Address
        );

        const { result } = renderHook(() => useOpenSession(), { wrapper });

        await expect(result.current.mutateAsync()).rejects.toThrow(
            "Failed to consume interactions"
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });

    it("should accept custom mutation options", async () => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { useConsumePendingInteractions } = await import(
            "./useConsumePendingInteractions"
        );

        const onSuccess = vi.fn();
        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);
        const consumePendingInteractions = vi.fn().mockResolvedValue({});

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);
        vi.mocked(useConsumePendingInteractions).mockReturnValue({
            mutateAsync: consumePendingInteractions,
        } as any);

        const { result } = renderHook(
            () =>
                useOpenSession({
                    mutations: { onSuccess },
                }),
            { wrapper }
        );

        await result.current.mutateAsync();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onSuccess.mock.calls[0][0]).toEqual({
            openSessionTxHash: mockTxHash,
        });
    });
});
