import { renderHook, waitFor } from "@testing-library/react";
import type { Address, Hex } from "viem";
import { readContract } from "viem/actions";
import { vi } from "vitest";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useProductInteractionContract } from "./useProductInteractionContract";

// Mock viem actions
vi.mock("viem/actions", () => ({
    readContract: vi.fn(),
}));

// Mock viem client
vi.mock("@/context/blockchain/provider", () => ({
    viemClient: {},
}));

describe("useProductInteractionContract", () => {
    const mockProductId = createMockAddress("product") as Hex;
    const mockContractAddress = createMockAddress("contract");

    describe("successful contract fetch", () => {
        test("should fetch interaction contract successfully", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(readContract).mockResolvedValue(
                mockContractAddress as any
            );

            const { result } = renderHook(
                () =>
                    useProductInteractionContract({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual({
                interactionContract: mockContractAddress,
            });
        });

        test("should handle when no interaction contract exists", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(readContract).mockResolvedValue(undefined as any);

            const { result } = renderHook(
                () =>
                    useProductInteractionContract({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.interactionContract).toBeUndefined();
        });
    });

    describe("error handling with tryit", () => {
        test("should handle contract read errors gracefully", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(readContract).mockRejectedValue(
                new Error("Contract not found")
            );

            const { result } = renderHook(
                () =>
                    useProductInteractionContract({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // tryit catches the error, so interactionContract should be undefined
            expect(result.current.data?.interactionContract).toBeUndefined();
        });

        test("should handle network errors gracefully", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(readContract).mockRejectedValue(
                new Error("Network error")
            );

            const { result } = renderHook(
                () =>
                    useProductInteractionContract({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Error is caught by tryit wrapper
            expect(result.current.data?.interactionContract).toBeUndefined();
        });
    });

    describe("query enabled state", () => {
        test("should be disabled when no productId provided", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(
                () =>
                    useProductInteractionContract({
                        productId: undefined as unknown as Hex,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(true);
            expect(result.current.data).toBeUndefined();
        });
    });

    describe("query key", () => {
        test("should use correct query key", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(readContract).mockResolvedValue(
                mockContractAddress as any
            );

            const { result } = renderHook(
                () =>
                    useProductInteractionContract({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const queries = queryWrapper.client.getQueryCache().getAll();
            const interactionQuery = queries.find((query) => {
                const key = query.queryKey;
                return (
                    key[0] === "product" &&
                    key[1] === "interaction-contract" &&
                    key[2] === mockProductId
                );
            });
            expect(interactionQuery).toBeDefined();
        });
    });

    describe("multiple products", () => {
        test("should handle different products independently", async ({
            queryWrapper,
        }: TestContext) => {
            const productId1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const productId2 =
                "0x2222222222222222222222222222222222222222" as Hex;
            const contract1 =
                "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
            const contract2 =
                "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;

            vi.mocked(readContract)
                .mockResolvedValueOnce(contract1 as any)
                .mockResolvedValueOnce(contract2 as any);

            const { result: result1 } = renderHook(
                () => useProductInteractionContract({ productId: productId1 }),
                { wrapper: queryWrapper.wrapper }
            );

            const { result: result2 } = renderHook(
                () => useProductInteractionContract({ productId: productId2 }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result1.current.isSuccess).toBe(true);
                expect(result2.current.isSuccess).toBe(true);
            });

            expect(result1.current.data?.interactionContract).toBe(contract1);
            expect(result2.current.data?.interactionContract).toBe(contract2);
        });
    });
});
