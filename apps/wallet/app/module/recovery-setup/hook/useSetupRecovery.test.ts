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
import { useSetupRecovery } from "./useSetupRecovery";

vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
    useSendTransaction: vi.fn(),
}));

describe("useSetupRecovery", () => {
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
        const { useAccount, useSendTransaction } = await import("wagmi");

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync: vi.fn(),
        } as any);

        const { result } = renderHook(() => useSetupRecovery(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isPending).toBe(false);
        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(result.current.setupRecovery).toBeDefined();
        expect(result.current.setupRecoveryAsync).toBeDefined();
    });

    test("should setup recovery successfully", async ({ queryWrapper }) => {
        const { useAccount, useSendTransaction } = await import("wagmi");

        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);

        const { result } = renderHook(() => useSetupRecovery(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.setupRecoveryAsync({
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
        const { useAccount, useSendTransaction } = await import("wagmi");

        vi.mocked(useAccount).mockReturnValue({ address: undefined } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync: vi.fn(),
        } as any);

        const { result } = renderHook(() => useSetupRecovery(), {
            wrapper: queryWrapper.wrapper,
        });

        const txHash = await result.current.setupRecoveryAsync({
            setupTxData: mockSetupTxData,
        });

        expect(txHash).toBeNull();
    });

    test("should invalidate recovery status queries after setup", async ({
        queryWrapper,
    }) => {
        const { useAccount, useSendTransaction } = await import("wagmi");

        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);

        const invalidateQueries = vi.spyOn(
            queryWrapper.client,
            "invalidateQueries"
        );

        const { result } = renderHook(() => useSetupRecovery(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.setupRecoveryAsync({
            setupTxData: mockSetupTxData,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(invalidateQueries).toHaveBeenCalled();
    });

    test("should handle transaction failure", async ({ queryWrapper }) => {
        const { useAccount, useSendTransaction } = await import("wagmi");

        const sendTransactionAsync = vi
            .fn()
            .mockRejectedValue(new Error("Transaction failed"));

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);

        const { result } = renderHook(() => useSetupRecovery(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.setupRecoveryAsync({ setupTxData: mockSetupTxData })
        ).rejects.toThrow("Transaction failed");

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });

    test("should accept custom mutation options", async ({ queryWrapper }) => {
        const { useAccount, useSendTransaction } = await import("wagmi");

        const sendTransactionAsync = vi.fn().mockResolvedValue(mockTxHash);

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(useSendTransaction).mockReturnValue({
            sendTransactionAsync,
        } as any);

        const onSuccess = vi.fn();

        const { result } = renderHook(() => useSetupRecovery({ onSuccess }), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.setupRecoveryAsync({
            setupTxData: mockSetupTxData,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalled();
        expect(onSuccess.mock.calls[0][0]).toBe(mockTxHash);
    });
});
