import {
    useSendTransactionAction,
    useWalletStatus,
} from "@frak-labs/react-sdk";
import { renderHook } from "@testing-library/react";
import type { Hex } from "viem";
import { simulateContract } from "viem/actions";
import { beforeEach, vi } from "vitest";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useAddProductBank } from "./useAddProductBank";

// Mock viem actions
vi.mock("viem/actions", () => ({
    simulateContract: vi.fn(),
}));

// Mock Frak SDK
vi.mock("@frak-labs/react-sdk", () => ({
    useSendTransactionAction: vi.fn(),
    useWalletStatus: vi.fn(),
}));

// Mock wait for tx utility
vi.mock("@/module/common/utils/useWaitForTxAndInvalidateQueries", () => ({
    useWaitForTxAndInvalidateQueries: vi.fn(),
}));

describe("useAddProductBank", () => {
    const mockProductId = createMockAddress("product");
    const mockWallet = createMockAddress("wallet");
    const mockBankAddress = createMockAddress("bank");

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("successful bank addition", () => {
        test("should add bank with USDC successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const mockHash = "0xabcdef123456789" as Hex;
            const mockSendTx = vi.fn().mockResolvedValue({ hash: mockHash });
            const mockWaitForTx = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);

            vi.mocked(useWalletStatus).mockReturnValue({
                data: { wallet: mockWallet },
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                mockWaitForTx
            );

            // Mock simulation to return bank address
            vi.mocked(simulateContract).mockResolvedValue({
                result: mockBankAddress,
            } as any);

            const { result } = renderHook(() => useAddProductBank(), {
                wrapper: queryWrapper.wrapper,
            });

            const addResult = await result.current.mutateAsync({
                productId: mockProductId,
                stablecoin: "usdc",
            });

            expect(addResult).toBe(mockHash);
            expect(mockSendTx).toHaveBeenCalled();
            expect(mockWaitForTx).toHaveBeenCalledWith({
                hash: mockHash,
                queryKey: ["product"],
            });
        });

        test("should handle different stablecoins", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi.fn().mockResolvedValue({ hash: "0xabc" }),
            } as any);

            vi.mocked(useWalletStatus).mockReturnValue({
                data: { wallet: mockWallet },
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );

            vi.mocked(simulateContract).mockResolvedValue({
                result: mockBankAddress,
            } as any);

            const { result } = renderHook(() => useAddProductBank(), {
                wrapper: queryWrapper.wrapper,
            });

            const stablecoins = ["usdc", "usde", "eure", "gbpe"] as const;

            for (const stablecoin of stablecoins) {
                await result.current.mutateAsync({
                    productId: mockProductId,
                    stablecoin,
                });
            }

            // Should have simulated for each stablecoin
            expect(vi.mocked(simulateContract)).toHaveBeenCalled();
        });
    });

    describe("wallet validation", () => {
        test("should throw error when wallet is not connected", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi.fn(),
            } as any);

            vi.mocked(useWalletStatus).mockReturnValue({
                data: { wallet: undefined },
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );

            const { result } = renderHook(() => useAddProductBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    productId: mockProductId,
                    stablecoin: "usdc",
                })
            ).rejects.toThrow("Wallet is not connected");
        });

        test("should throw error when wallet is null", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi.fn(),
            } as any);

            vi.mocked(useWalletStatus).mockReturnValue({
                data: null,
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );

            const { result } = renderHook(() => useAddProductBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    productId: mockProductId,
                    stablecoin: "usdc",
                })
            ).rejects.toThrow("Wallet is not connected");
        });
    });

    describe("simulation validation", () => {
        test("should throw error when simulation returns zero address", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi.fn(),
            } as any);

            vi.mocked(useWalletStatus).mockReturnValue({
                data: { wallet: mockWallet },
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );

            vi.mocked(simulateContract).mockResolvedValue({
                result: "0x0000000000000000000000000000000000000000",
            } as any);

            const { result } = renderHook(() => useAddProductBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    productId: mockProductId,
                    stablecoin: "usdc",
                })
            ).rejects.toThrow("Failed to simulate bank deployment");
        });

        test("should throw error when simulation returns undefined", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi.fn(),
            } as any);

            vi.mocked(useWalletStatus).mockReturnValue({
                data: { wallet: mockWallet },
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );

            vi.mocked(simulateContract).mockResolvedValue({
                result: undefined,
            } as any);

            const { result } = renderHook(() => useAddProductBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    productId: mockProductId,
                    stablecoin: "usdc",
                })
            ).rejects.toThrow("Failed to simulate bank deployment");
        });
    });

    describe("error handling", () => {
        test("should handle simulation errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi.fn(),
            } as any);

            vi.mocked(useWalletStatus).mockReturnValue({
                data: { wallet: mockWallet },
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );

            vi.mocked(simulateContract).mockRejectedValue(
                new Error("Simulation failed")
            );

            const { result } = renderHook(() => useAddProductBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    productId: mockProductId,
                    stablecoin: "usdc",
                })
            ).rejects.toThrow("Simulation failed");
        });

        test("should handle transaction errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi
                    .fn()
                    .mockRejectedValue(new Error("Transaction failed")),
            } as any);

            vi.mocked(useWalletStatus).mockReturnValue({
                data: { wallet: mockWallet },
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );

            vi.mocked(simulateContract).mockResolvedValue({
                result: mockBankAddress,
            } as any);

            const { result } = renderHook(() => useAddProductBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    productId: mockProductId,
                    stablecoin: "usdc",
                })
            ).rejects.toThrow("Transaction failed");
        });
    });
});
