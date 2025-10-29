import { renderHook, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
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
    beforeEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test("should not execute when no address is provided", async ({
        queryWrapper,
    }) => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { getDisableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );

        const sendTransactionAsync = vi.fn();

        vi.mocked(useAccount).mockReturnValue({ address: undefined } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);

        const { result } = renderHook(() => useCloseSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.mutateAsync();

        expect(result.current.data).toBeUndefined();
        expect(sendTransactionAsync).not.toHaveBeenCalled();
        expect(getDisableSessionData).not.toHaveBeenCalled();
    });

    test("should close session successfully", async ({
        queryWrapper,
        mockAddress,
    }) => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { getDisableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );
        const { trackGenericEvent } = await import("../../common/analytics");

        const { createMockAddress } = await import("../../test/factories");
        const mockTxHash = createMockAddress("abcdef");
        const mockDisableData: Address =
            "0xdisabledata1234567890abcdef1234567890abcd";
        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);
        vi.mocked(getDisableSessionData).mockReturnValue(mockDisableData);

        const { result } = renderHook(() => useCloseSession(), {
            wrapper: queryWrapper.wrapper,
        });

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

    test("should invalidate session status queries after closing", async ({
        queryWrapper,
        mockAddress,
    }) => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { getDisableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );

        const { createMockAddress } = await import("../../test/factories");
        const mockTxHash = createMockAddress("abcdef");
        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);
        const invalidateQueries = vi.spyOn(
            queryWrapper.client,
            "invalidateQueries"
        );

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);
        vi.mocked(getDisableSessionData).mockReturnValue(
            "0xdisabledata" as Address
        );

        const { result } = renderHook(() => useCloseSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.mutateAsync();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(invalidateQueries).toHaveBeenCalled();
    });

    test("should handle transaction errors", async ({
        queryWrapper,
        mockAddress,
    }) => {
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

        const { result } = renderHook(() => useCloseSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(result.current.mutateAsync()).rejects.toThrow(
            "Transaction failed"
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(mockError);
    });

    test("should log transaction hash", async ({
        queryWrapper,
        mockAddress,
    }) => {
        const { useAccount, useSendTransaction } = await import("wagmi");
        const { getDisableSessionData } = await import(
            "../../interaction/utils/getEnableDisableData"
        );

        const { createMockAddress } = await import("../../test/factories");
        const mockTxHash = createMockAddress("abcdef");
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

        const { result } = renderHook(() => useCloseSession(), {
            wrapper: queryWrapper.wrapper,
        });

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
