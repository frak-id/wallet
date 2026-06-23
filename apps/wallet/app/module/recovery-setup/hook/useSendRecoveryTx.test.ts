/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { useSendRecoveryTx } from "./useSendRecoveryTx";

vi.mock("wagmi", () => ({
    useConnection: vi.fn(),
    useSendTransaction: vi.fn(),
}));

vi.mock("viem/actions", () => ({
    waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
}));

describe("useSendRecoveryTx", () => {
    const mockAddress = "0x1234567890123456789012345678901234567890" as Hex;
    const mockTxHash =
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;
    const mockSetupTxData = "0xsetuptxdata1234567890" as Hex;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("should initialize with correct default state", async ({
        queryWrapper,
    }) => {
        const { useConnection, useSendTransaction } = await import("wagmi");

        vi.mocked(useConnection).mockReturnValue({
            address: mockAddress,
        } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            mutateAsync: vi.fn(),
        } as any);

        const { result } = renderHook(() => useSendRecoveryTx(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isPending).toBe(false);
        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(result.current.sendRecoveryTx).toBeDefined();
        expect(result.current.sendRecoveryTxAsync).toBeDefined();
    });

    test("should setup recovery successfully", async ({ queryWrapper }) => {
        const { useConnection, useSendTransaction } = await import("wagmi");

        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);

        vi.mocked(useConnection).mockReturnValue({
            address: mockAddress,
        } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            mutateAsync: sendTransactionAsync,
        } as any);

        const { result } = renderHook(() => useSendRecoveryTx(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.sendRecoveryTxAsync({
            setupTxData: mockSetupTxData,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBe(mockTxHash);
        expect(sendTransactionAsync).toHaveBeenCalledWith({
            to: mockAddress,
            data: mockSetupTxData,
        });
    });

    test("should return null when no address is available", async ({
        queryWrapper,
    }) => {
        const { useConnection, useSendTransaction } = await import("wagmi");

        vi.mocked(useConnection).mockReturnValue({ address: undefined } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            mutateAsync: vi.fn(),
        } as any);

        const { result } = renderHook(() => useSendRecoveryTx(), {
            wrapper: queryWrapper.wrapper,
        });

        const txHash = await result.current.sendRecoveryTxAsync({
            setupTxData: mockSetupTxData,
        });

        expect(txHash).toBeNull();
    });

    test("should invalidate recovery status queries after setup", async ({
        queryWrapper,
    }) => {
        const { useConnection, useSendTransaction } = await import("wagmi");

        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);

        vi.mocked(useConnection).mockReturnValue({
            address: mockAddress,
        } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            mutateAsync: sendTransactionAsync,
        } as any);

        const invalidateQueries = vi.spyOn(
            queryWrapper.client,
            "invalidateQueries"
        );

        const { result } = renderHook(() => useSendRecoveryTx(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.sendRecoveryTxAsync({
            setupTxData: mockSetupTxData,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(invalidateQueries).toHaveBeenCalled();
    });

    test("should wait for tx confirmations before invalidating", async ({
        queryWrapper,
    }) => {
        const { useConnection, useSendTransaction } = await import("wagmi");
        const { waitForTransactionReceipt } = await import("viem/actions");

        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);

        vi.mocked(useConnection).mockReturnValue({
            address: mockAddress,
        } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            mutateAsync: sendTransactionAsync,
        } as any);

        const order: string[] = [];
        vi.mocked(waitForTransactionReceipt).mockImplementation(async () => {
            order.push("wait");
            return {} as any;
        });
        const invalidateQueries = vi
            .spyOn(queryWrapper.client, "invalidateQueries")
            .mockImplementation(async () => {
                order.push("invalidate");
            });

        const { result } = renderHook(() => useSendRecoveryTx(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.sendRecoveryTxAsync({
            setupTxData: mockSetupTxData,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(waitForTransactionReceipt).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ hash: mockTxHash, confirmations: 8 })
        );
        expect(invalidateQueries).toHaveBeenCalled();
        expect(order).toEqual(["wait", "invalidate"]);
    });

    test("should handle transaction failure", async ({ queryWrapper }) => {
        const { useConnection, useSendTransaction } = await import("wagmi");

        const sendTransactionAsync = vi
            .fn()
            .mockRejectedValue(new Error("Transaction failed"));

        vi.mocked(useConnection).mockReturnValue({
            address: mockAddress,
        } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            mutateAsync: sendTransactionAsync,
        } as any);

        const { result } = renderHook(() => useSendRecoveryTx(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.sendRecoveryTxAsync({ setupTxData: mockSetupTxData })
        ).rejects.toThrow("Transaction failed");

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });

    test("should accept custom mutation options", async ({ queryWrapper }) => {
        const { useConnection, useSendTransaction } = await import("wagmi");

        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);

        vi.mocked(useConnection).mockReturnValue({
            address: mockAddress,
        } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            mutateAsync: sendTransactionAsync,
        } as any);

        const onSuccess = vi.fn();

        const { result } = renderHook(() => useSendRecoveryTx({ onSuccess }), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.sendRecoveryTxAsync({
            setupTxData: mockSetupTxData,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalled();
        expect(onSuccess.mock.calls[0][0]).toBe(mockTxHash);
    });
});
