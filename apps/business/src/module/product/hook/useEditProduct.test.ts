import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { beforeEach, vi } from "vitest";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useEditProduct } from "./useEditProduct";
import { useProductInteractionContract } from "./useProductInteractionContract";

// Mock the dependencies
vi.mock("@frak-labs/react-sdk", () => ({
    useSendTransactionAction: vi.fn(),
}));

vi.mock("@/module/common/utils/useWaitForTxAndInvalidateQueries", () => ({
    useWaitForTxAndInvalidateQueries: vi.fn(),
}));

vi.mock("./useProductInteractionContract", () => ({
    useProductInteractionContract: vi.fn(),
}));

vi.mock("@/module/product/utils/productTypes", () => ({
    encodeProductTypesMask: vi.fn(() => BigInt(1)),
}));

describe("useEditProduct", () => {
    const mockProductId = createMockAddress("product") as Hex;
    const mockTxHash = createMockAddress("tx-hash") as Hex;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("successful product edit", () => {
        test("should update product metadata without interaction contract", async ({
            queryWrapper,
        }: TestContext) => {
            const sendTransactionMock = vi.fn().mockResolvedValue({
                hash: mockTxHash,
            });
            const waitForTxMock = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: sendTransactionMock,
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                waitForTxMock
            );

            vi.mocked(useProductInteractionContract).mockReturnValue({
                data: undefined,
            } as any);

            const { result } = renderHook(
                () => useEditProduct({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                name: "Updated Product",
                productTypes: ["press"],
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(sendTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    tx: expect.arrayContaining([
                        expect.objectContaining({
                            to: expect.any(String),
                            data: expect.any(String),
                        }),
                    ]),
                    metadata: expect.objectContaining({
                        header: expect.objectContaining({
                            title: "Update product",
                        }),
                    }),
                })
            );

            expect(waitForTxMock).toHaveBeenCalledWith({
                hash: mockTxHash,
                queryKey: ["product", mockProductId],
            });
        });

        test("should update product with interaction contract", async ({
            queryWrapper,
        }: TestContext) => {
            const mockInteractionContract =
                "0x9876543210987654321098765432109876543210" as Hex;
            const sendTransactionMock = vi.fn().mockResolvedValue({
                hash: mockTxHash,
            });
            const waitForTxMock = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: sendTransactionMock,
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                waitForTxMock
            );

            vi.mocked(useProductInteractionContract).mockReturnValue({
                data: mockInteractionContract,
            } as any);

            const { result } = renderHook(
                () => useEditProduct({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                name: "Product with Interactions",
                productTypes: ["press", "webshop"],
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Should send 2 transactions: metadata update + interaction contract update
            expect(sendTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    tx: expect.arrayContaining([
                        expect.any(Object),
                        expect.any(Object),
                    ]),
                })
            );

            const txArg = sendTransactionMock.mock.calls[0][0];
            expect(txArg.tx).toHaveLength(2);
        });

        test("should encode product types correctly", async ({
            queryWrapper,
        }: TestContext) => {
            const sendTransactionMock = vi.fn().mockResolvedValue({
                hash: mockTxHash,
            });

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: sendTransactionMock,
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn().mockResolvedValue(undefined)
            );

            vi.mocked(useProductInteractionContract).mockReturnValue({
                data: undefined,
            } as any);

            const { result } = renderHook(
                () => useEditProduct({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                name: "Multi-type Product",
                productTypes: ["press", "webshop", "dapp"],
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(sendTransactionMock).toHaveBeenCalled();
        });
    });

    describe("mutation states", () => {
        test("should track pending state during mutation", async ({
            queryWrapper,
        }: TestContext) => {
            let resolveTransaction: (value: any) => void;
            const transactionPromise = new Promise((resolve) => {
                resolveTransaction = resolve;
            });

            const sendTransactionMock = vi
                .fn()
                .mockReturnValue(transactionPromise);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: sendTransactionMock,
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn().mockResolvedValue(undefined)
            );

            vi.mocked(useProductInteractionContract).mockReturnValue({
                data: undefined,
            } as any);

            const { result } = renderHook(
                () => useEditProduct({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(false);

            result.current.mutate({
                name: "Test",
                productTypes: ["press"],
            });

            await waitFor(() => {
                expect(result.current.isPending).toBe(true);
            });

            resolveTransaction!({ hash: mockTxHash });

            await waitFor(() => {
                expect(result.current.isPending).toBe(false);
            });
        });

        test("should return transaction hash on success", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi.fn().mockResolvedValue({ hash: mockTxHash }),
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn().mockResolvedValue(undefined)
            );

            vi.mocked(useProductInteractionContract).mockReturnValue({
                data: undefined,
            } as any);

            const { result } = renderHook(
                () => useEditProduct({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                name: "Test",
                productTypes: ["press"],
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual({ hash: mockTxHash });
        });
    });

    describe("error handling", () => {
        test("should handle transaction send errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi
                    .fn()
                    .mockRejectedValue(new Error("Transaction rejected")),
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );

            vi.mocked(useProductInteractionContract).mockReturnValue({
                data: undefined,
            } as any);

            const { result } = renderHook(
                () => useEditProduct({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({
                    name: "Test",
                    productTypes: ["press"],
                })
            ).rejects.toThrow("Transaction rejected");
        });

        test("should handle wait for transaction errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi.fn().mockResolvedValue({ hash: mockTxHash }),
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn().mockRejectedValue(new Error("Confirmation timeout"))
            );

            vi.mocked(useProductInteractionContract).mockReturnValue({
                data: undefined,
            } as any);

            const { result } = renderHook(
                () => useEditProduct({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({
                    name: "Test",
                    productTypes: ["press"],
                })
            ).rejects.toThrow("Confirmation timeout");
        });
    });

    describe("i18n metadata", () => {
        test("should include French and English translations", async ({
            queryWrapper,
        }: TestContext) => {
            const sendTransactionMock = vi.fn().mockResolvedValue({
                hash: mockTxHash,
            });

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: sendTransactionMock,
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn().mockResolvedValue(undefined)
            );

            vi.mocked(useProductInteractionContract).mockReturnValue({
                data: undefined,
            } as any);

            const { result } = renderHook(
                () => useEditProduct({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                name: "Test",
                productTypes: ["press"],
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const metadata = sendTransactionMock.mock.calls[0][0].metadata;
            expect(metadata.i18n.fr).toBeDefined();
            expect(metadata.i18n.en).toBeDefined();
            expect(
                metadata.i18n.fr["sdk.modal.sendTransaction.description"]
            ).toBeTruthy();
            expect(
                metadata.i18n.en["sdk.modal.sendTransaction.description"]
            ).toBeTruthy();
        });
    });

    describe("cache invalidation", () => {
        test("should invalidate product queries after edit", async ({
            queryWrapper,
        }: TestContext) => {
            const waitForTxMock = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi.fn().mockResolvedValue({ hash: mockTxHash }),
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                waitForTxMock
            );

            vi.mocked(useProductInteractionContract).mockReturnValue({
                data: undefined,
            } as any);

            const { result } = renderHook(
                () => useEditProduct({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                name: "Test",
                productTypes: ["press"],
            });

            expect(waitForTxMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    queryKey: ["product", mockProductId],
                })
            );
        });
    });

    describe("additional edge cases", () => {
        test("should handle single product type", async ({
            queryWrapper,
        }: TestContext) => {
            const sendTransactionMock = vi.fn().mockResolvedValue({
                hash: mockTxHash,
            });

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: sendTransactionMock,
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn().mockResolvedValue(undefined)
            );

            vi.mocked(useProductInteractionContract).mockReturnValue({
                data: undefined,
            } as any);

            const { result } = renderHook(
                () => useEditProduct({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                name: "Single Type Product",
                productTypes: ["press"],
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(sendTransactionMock).toHaveBeenCalled();
        });

        test("should handle long product names", async ({
            queryWrapper,
        }: TestContext) => {
            const sendTransactionMock = vi.fn().mockResolvedValue({
                hash: mockTxHash,
            });

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: sendTransactionMock,
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn().mockResolvedValue(undefined)
            );

            vi.mocked(useProductInteractionContract).mockReturnValue({
                data: undefined,
            } as any);

            const { result } = renderHook(
                () => useEditProduct({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            const longName = "A".repeat(100);

            await result.current.mutateAsync({
                name: longName,
                productTypes: ["press"],
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(sendTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        header: expect.objectContaining({
                            title: "Update product",
                        }),
                    }),
                })
            );
        });

        test("should handle all product types", async ({
            queryWrapper,
        }: TestContext) => {
            const sendTransactionMock = vi.fn().mockResolvedValue({
                hash: mockTxHash,
            });

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: sendTransactionMock,
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn().mockResolvedValue(undefined)
            );

            vi.mocked(useProductInteractionContract).mockReturnValue({
                data: undefined,
            } as any);

            const { result } = renderHook(
                () => useEditProduct({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                name: "All Types",
                productTypes: ["press", "webshop", "dapp", "referral"],
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });

        test("should handle rapid successive edits", async ({
            queryWrapper,
        }: TestContext) => {
            const sendTransactionMock = vi.fn().mockResolvedValue({
                hash: mockTxHash,
            });

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: sendTransactionMock,
            } as any);

            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn().mockResolvedValue(undefined)
            );

            vi.mocked(useProductInteractionContract).mockReturnValue({
                data: undefined,
            } as any);

            const { result } = renderHook(
                () => useEditProduct({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            // First edit
            await result.current.mutateAsync({
                name: "First Edit",
                productTypes: ["press"],
            });

            // Second edit
            await result.current.mutateAsync({
                name: "Second Edit",
                productTypes: ["webshop"],
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(sendTransactionMock).toHaveBeenCalledTimes(2);
        });
    });
});
