import { renderHook, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { readContract } from "viem/actions";
import { beforeEach, vi } from "vitest";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useGetBankInfo } from "./useGetBankInfo";

// Mock viem actions
vi.mock("viem/actions", () => ({
    readContract: vi.fn(),
}));

// Mock viem client
vi.mock("@/context/blockchain/provider", () => ({
    viemClient: {},
}));

describe("useGetBankInfo", () => {
    const mockBankAddress = createMockAddress("bank");
    const mockTokenAddress = createMockAddress("token");

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("successful bank info retrieval", () => {
        test("should fetch bank token and decimals successfully", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock getConfig returns token address
            // Mock decimals returns 18
            vi.mocked(readContract)
                .mockResolvedValueOnce([null, mockTokenAddress] as any)
                .mockResolvedValueOnce(18);

            const { result } = renderHook(
                () => useGetBankInfo({ bank: mockBankAddress }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.bankInfo).toBeDefined();
            });

            expect(result.current.bankInfo).toEqual({
                token: mockTokenAddress,
                decimals: 18,
            });

            expect(readContract).toHaveBeenCalledTimes(2);
        });

        test("should handle tokens with 6 decimals (USDC-like)", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(readContract)
                .mockResolvedValueOnce([null, mockTokenAddress] as any)
                .mockResolvedValueOnce(6);

            const { result } = renderHook(
                () => useGetBankInfo({ bank: mockBankAddress }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.bankInfo).toBeDefined();
            });

            expect(result.current.bankInfo?.decimals).toBe(6);
        });

        test("should handle tokens with 0 decimals", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(readContract)
                .mockResolvedValueOnce([null, mockTokenAddress] as any)
                .mockResolvedValueOnce(0);

            const { result } = renderHook(
                () => useGetBankInfo({ bank: mockBankAddress }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.bankInfo).toBeDefined();
            });

            expect(result.current.bankInfo?.decimals).toBe(0);
        });
    });

    describe("invalid address handling", () => {
        test("should return null for empty string bank address", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(() => useGetBankInfo({ bank: "" }), {
                wrapper: queryWrapper.wrapper,
            });

            // When enabled is false, query will not run and data will remain undefined
            // This is expected TanStack Query behavior
            expect(result.current.isPending).toBe(true);
            expect(result.current.data).toBeUndefined();
        });

        test("should return null for undefined bank address", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(
                () => useGetBankInfo({ bank: undefined }),
                { wrapper: queryWrapper.wrapper }
            );

            // When enabled is false, query will not run and data will remain undefined
            // This is expected TanStack Query behavior
            expect(result.current.isPending).toBe(true);
            expect(result.current.data).toBeUndefined();
        });

        test("should return null for invalid address format", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(readContract).mockResolvedValue([
                null,
                mockTokenAddress,
            ] as any);

            const { result } = renderHook(
                () => useGetBankInfo({ bank: "invalid" as Address }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.data).toBe(null);
            });
        });
    });

    describe("query disabled state", () => {
        test("should be disabled when no bank address provided", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(
                () => useGetBankInfo({ bank: undefined }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(true);
            expect(result.current.data).toBeUndefined();
        });

        test("should be disabled when empty string bank address provided", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(() => useGetBankInfo({ bank: "" }), {
                wrapper: queryWrapper.wrapper,
            });

            expect(result.current.isPending).toBe(true);
            expect(result.current.data).toBeUndefined();
        });
    });

    describe("error handling", () => {
        test("should handle contract read errors for getConfig", async ({
            queryWrapper,
        }: TestContext) => {
            const consoleErrorSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            vi.mocked(readContract).mockRejectedValue(
                new Error("Contract read failed")
            );

            const { result } = renderHook(
                () => useGetBankInfo({ bank: mockBankAddress }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        test("should handle contract read errors for decimals", async ({
            queryWrapper,
        }: TestContext) => {
            const consoleErrorSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            // First call succeeds, second fails
            vi.mocked(readContract)
                .mockResolvedValueOnce([null, mockTokenAddress] as any)
                .mockRejectedValueOnce(new Error("Decimals read failed"));

            const { result } = renderHook(
                () => useGetBankInfo({ bank: mockBankAddress }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        test("should handle network errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(readContract).mockRejectedValue(
                new Error("Network error")
            );

            const { result } = renderHook(
                () => useGetBankInfo({ bank: mockBankAddress }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect((result.current.error as Error).message).toBe(
                "Network error"
            );
        });
    });

    describe("console logging", () => {
        test("should log data when successfully fetched", async ({
            queryWrapper,
        }: TestContext) => {
            const consoleLogSpy = vi
                .spyOn(console, "log")
                .mockImplementation(() => {});

            vi.mocked(readContract)
                .mockResolvedValueOnce([null, mockTokenAddress] as any)
                .mockResolvedValueOnce(18);

            const { result } = renderHook(
                () => useGetBankInfo({ bank: mockBankAddress }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.bankInfo).toBeDefined();
            });

            expect(consoleLogSpy).toHaveBeenCalledWith("data for bank", {
                data: { token: mockTokenAddress, decimals: 18 },
                bank: mockBankAddress,
            });

            consoleLogSpy.mockRestore();
        });

        test("should log errors when fetch fails", async ({
            queryWrapper,
        }: TestContext) => {
            const consoleErrorSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            const mockError = new Error("Test error");
            vi.mocked(readContract).mockRejectedValue(mockError);

            const { result } = renderHook(
                () => useGetBankInfo({ bank: mockBankAddress }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });

    describe("query return values", () => {
        test("should return bankInfo along with query state", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(readContract)
                .mockResolvedValueOnce([null, mockTokenAddress] as any)
                .mockResolvedValueOnce(18);

            const { result } = renderHook(
                () => useGetBankInfo({ bank: mockBankAddress }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Check that it returns both bankInfo and standard query properties
            expect(result.current.bankInfo).toBeDefined();
            expect(result.current.data).toBeDefined();
            expect(result.current.isSuccess).toBe(true);
            expect(result.current.isError).toBe(false);
            expect(result.current.isPending).toBe(false);
        });

        test("should return undefined bankInfo when query is pending", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(
                () => useGetBankInfo({ bank: undefined }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.bankInfo).toBeUndefined();
            expect(result.current.isPending).toBe(true);
        });
    });

    describe("multiple banks", () => {
        test("should handle switching between different banks", async ({
            queryWrapper,
        }: TestContext) => {
            const bank1 =
                "0x1111111111111111111111111111111111111111" as Address;
            const bank2 =
                "0x2222222222222222222222222222222222222222" as Address;
            const token1 =
                "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
            const token2 =
                "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;

            vi.mocked(readContract)
                .mockResolvedValueOnce([null, token1] as any)
                .mockResolvedValueOnce(18)
                .mockResolvedValueOnce([null, token2] as any)
                .mockResolvedValueOnce(6);

            // First bank
            const { result, rerender } = renderHook(
                ({ bank }: { bank?: Address | "" }) => useGetBankInfo({ bank }),
                {
                    wrapper: queryWrapper.wrapper,
                    initialProps: { bank: bank1 },
                }
            );

            await waitFor(() => {
                expect(result.current.bankInfo?.token).toBe(token1);
            });

            expect(result.current.bankInfo?.decimals).toBe(18);

            // Switch to second bank
            rerender({ bank: bank2 });

            await waitFor(() => {
                expect(result.current.bankInfo?.token).toBe(token2);
            });

            expect(result.current.bankInfo?.decimals).toBe(6);
        });
    });

    describe("ABI calls", () => {
        test("should call campaignBankAbi.getConfig", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(readContract)
                .mockResolvedValueOnce([null, mockTokenAddress] as any)
                .mockResolvedValueOnce(18);

            const { result } = renderHook(
                () => useGetBankInfo({ bank: mockBankAddress }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Check first readContract call was for getConfig
            const firstCall = vi.mocked(readContract).mock.calls[0][1];
            expect(firstCall).toHaveProperty("address", mockBankAddress);
            expect(firstCall).toHaveProperty("functionName", "getConfig");
        });

        test("should call erc20Abi.decimals", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(readContract)
                .mockResolvedValueOnce([null, mockTokenAddress] as any)
                .mockResolvedValueOnce(18);

            const { result } = renderHook(
                () => useGetBankInfo({ bank: mockBankAddress }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Check second readContract call was for decimals
            const secondCall = vi.mocked(readContract).mock.calls[1][1];
            expect(secondCall).toHaveProperty("address", mockTokenAddress);
            expect(secondCall).toHaveProperty("functionName", "decimals");
        });
    });
});
