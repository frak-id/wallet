import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { useGetUserPendingBalance } from "./useGetUserPendingBalance";

vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

vi.mock("../../common/api/backendClient", () => ({
    authenticatedWalletApi: {
        balance: {
            pending: {
                get: vi.fn(),
            },
        },
    },
}));

describe("useGetUserPendingBalance", () => {
    beforeEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test("should return null pending balance when no address is provided", async ({
        queryWrapper,
    }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: undefined,
        } as any);

        const { result } = renderHook(() => useGetUserPendingBalance(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.userPendingBalance).toBeUndefined();
            expect(result.current.isLoading).toBe(false);
        });
    });

    test("should fetch pending balance when address is provided", async ({
        queryWrapper,
    }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";
        const mockPendingBalance = {
            pending: "5000000000000000000",
            formatted: "5.0",
        };

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.balance.pending.get).mockResolvedValue(
            {
                data: mockPendingBalance,
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetUserPendingBalance(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.userPendingBalance).toEqual(
                mockPendingBalance
            );
        });

        expect(
            authenticatedWalletApi.balance.pending.get
        ).toHaveBeenCalledTimes(1);
    });

    test("should handle API errors", async ({ queryWrapper }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";
        const mockError = new Error("Pending balance API Error");

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.balance.pending.get).mockResolvedValue(
            {
                data: null,
                error: mockError,
            } as any
        );

        const { result } = renderHook(() => useGetUserPendingBalance(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.error).toEqual(mockError);
            expect(result.current.userPendingBalance).toBeUndefined();
        });
    });

    test("should refetch when refetch is called", async ({ queryWrapper }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";
        const mockBalance1 = { pending: "1000", formatted: "0.001" };
        const mockBalance2 = { pending: "3000", formatted: "0.003" };

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.balance.pending.get)
            .mockResolvedValueOnce({
                data: mockBalance1,
                error: null,
            } as any)
            .mockResolvedValueOnce({
                data: mockBalance2,
                error: null,
            } as any);

        const { result } = renderHook(() => useGetUserPendingBalance(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.userPendingBalance).toEqual(mockBalance1);
        });

        await result.current.refetch();

        await waitFor(() => {
            expect(result.current.userPendingBalance).toEqual(mockBalance2);
        });

        expect(
            authenticatedWalletApi.balance.pending.get
        ).toHaveBeenCalledTimes(2);
    });

    test("should not fetch when address is null", async ({ queryWrapper }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: null,
        } as any);

        renderHook(() => useGetUserPendingBalance(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(
                authenticatedWalletApi.balance.pending.get
            ).not.toHaveBeenCalled();
        });
    });

    test("should use refetch options for pending balance", async ({
        queryWrapper,
    }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.balance.pending.get).mockResolvedValue(
            {
                data: { pending: "100", formatted: "0.0001" },
                error: null,
            } as any
        );

        const { result } = renderHook(() => useGetUserPendingBalance(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.refetch).toBeDefined();
        expect(typeof result.current.refetch).toBe("function");
    });
});
