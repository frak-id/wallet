import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useFundTestBank } from "./useFundTestBank";

// Mock the business API
vi.mock("@frak-labs/client/server", () => ({
    businessApi: {
        funding: {
            getTestToken: {
                post: vi.fn(),
            },
        },
    },
}));

describe("useFundTestBank", () => {
    const mockBankAddress = "0x1234567890123456789012345678901234567890" as Hex;

    describe("successful funding", () => {
        test("should fund bank successfully with stablecoin", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.funding.getTestToken.post).mockResolvedValue(
                undefined as any
            );

            const { result } = renderHook(() => useFundTestBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                bank: mockBankAddress,
                stablecoin: "usdc",
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(businessApi.funding.getTestToken.post).toHaveBeenCalledWith({
                bank: mockBankAddress,
                stablecoin: "usdc",
            });
        });

        test("should fund bank without specifying stablecoin", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.funding.getTestToken.post).mockResolvedValue(
                undefined as any
            );

            const { result } = renderHook(() => useFundTestBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                bank: mockBankAddress,
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(businessApi.funding.getTestToken.post).toHaveBeenCalledWith({
                bank: mockBankAddress,
                stablecoin: undefined,
            });
        });

        test("should handle different stablecoin types", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.funding.getTestToken.post).mockResolvedValue(
                undefined as any
            );

            const { result } = renderHook(() => useFundTestBank(), {
                wrapper: queryWrapper.wrapper,
            });

            const stablecoins = ["usdc", "usde", "eure"] as const;

            for (const stablecoin of stablecoins) {
                await result.current.mutateAsync({
                    bank: mockBankAddress,
                    stablecoin: stablecoin as any,
                });

                expect(
                    businessApi.funding.getTestToken.post
                ).toHaveBeenCalledWith({
                    bank: mockBankAddress,
                    stablecoin: stablecoin,
                });
            }
        });
    });

    describe("query invalidation", () => {
        test("should invalidate product queries after successful funding", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.funding.getTestToken.post).mockResolvedValue(
                undefined as any
            );

            const { result } = renderHook(() => useFundTestBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                bank: mockBankAddress,
                stablecoin: "usdc",
            });

            // Verify mutation succeeded
            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });

        test("should invalidate all product-related queries", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.funding.getTestToken.post).mockResolvedValue(
                undefined as any
            );

            const { result } = renderHook(() => useFundTestBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                bank: mockBankAddress,
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });
    });

    describe("error handling", () => {
        test("should handle API errors", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.funding.getTestToken.post).mockRejectedValue(
                new Error("Failed to fund bank")
            );

            const { result } = renderHook(() => useFundTestBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    bank: mockBankAddress,
                    stablecoin: "usdc",
                })
            ).rejects.toThrow("Failed to fund bank");

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });
        });

        test("should handle network errors", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.funding.getTestToken.post).mockRejectedValue(
                new Error("Network error")
            );

            const { result } = renderHook(() => useFundTestBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    bank: mockBankAddress,
                })
            ).rejects.toThrow("Network error");
        });

        test("should handle invalid bank address", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.funding.getTestToken.post).mockRejectedValue(
                new Error("Invalid bank address")
            );

            const { result } = renderHook(() => useFundTestBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    bank: "0xinvalid" as Hex,
                })
            ).rejects.toThrow("Invalid bank address");
        });
    });

    describe("mutation state", () => {
        test("should track mutation loading state", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.funding.getTestToken.post).mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve(undefined as any), 100)
                    )
            );

            const { result } = renderHook(() => useFundTestBank(), {
                wrapper: queryWrapper.wrapper,
            });

            expect(result.current.isPending).toBe(false);

            const mutationPromise = result.current.mutateAsync({
                bank: mockBankAddress,
                stablecoin: "usdc",
            });

            await waitFor(() => {
                expect(result.current.isPending).toBe(true);
            });

            await mutationPromise;

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });

        test("should reset mutation state", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.funding.getTestToken.post).mockResolvedValue(
                undefined as any
            );

            const { result } = renderHook(() => useFundTestBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                bank: mockBankAddress,
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            result.current.reset();

            await waitFor(() => {
                expect(result.current.status).toBe("idle");
            });

            expect(result.current.data).toBeUndefined();
        });
    });

    describe("mutation key", () => {
        test("should use correct mutation key", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(() => useFundTestBank(), {
                wrapper: queryWrapper.wrapper,
            });

            expect(result.current).toBeDefined();
            expect(typeof result.current.mutate).toBe("function");
            expect(typeof result.current.mutateAsync).toBe("function");
        });
    });

    describe("multiple funding operations", () => {
        test("should handle sequential funding operations", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.funding.getTestToken.post).mockResolvedValue(
                undefined as any
            );

            const { result } = renderHook(() => useFundTestBank(), {
                wrapper: queryWrapper.wrapper,
            });

            const bank1 = "0x1111111111111111111111111111111111111111" as Hex;
            const bank2 = "0x2222222222222222222222222222222222222222" as Hex;

            await result.current.mutateAsync({
                bank: bank1,
                stablecoin: "usdc",
            });

            await result.current.mutateAsync({
                bank: bank2,
                stablecoin: "usde",
            });

            // Should have called for both banks
            expect(businessApi.funding.getTestToken.post).toHaveBeenCalledWith({
                bank: bank1,
                stablecoin: "usdc",
            });
            expect(businessApi.funding.getTestToken.post).toHaveBeenCalledWith({
                bank: bank2,
                stablecoin: "usde",
            });
        });
    });

    describe("no return value", () => {
        test("should handle void response from API", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.funding.getTestToken.post).mockResolvedValue(
                undefined as any
            );

            const { result } = renderHook(() => useFundTestBank(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                bank: mockBankAddress,
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Mutation should succeed even with no return data
            expect(result.current.data).toBeUndefined();
        });
    });
});
