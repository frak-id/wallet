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
import { useGetUserBalance } from "./useGetUserBalance";

vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

vi.mock("../../common/api/backendClient", () => ({
    authenticatedWalletApi: {
        balance: {
            get: vi.fn(),
        },
    },
}));

describe("useGetUserBalance", () => {
    beforeEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test("should return null balance when no address is provided", async ({
        queryWrapper,
    }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: undefined,
        } as any);

        const { result } = renderHook(() => useGetUserBalance(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.userBalance).toBeUndefined();
            expect(result.current.isLoading).toBe(false);
        });
    });

    test("should fetch balance when address is provided", async ({
        queryWrapper,
    }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";
        const mockBalance = {
            balance: "1000000000000000000",
            formatted: "1.0",
        };

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.balance.get).mockResolvedValue({
            data: mockBalance,
            error: null,
        } as any);

        const { result } = renderHook(() => useGetUserBalance(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.userBalance).toEqual(mockBalance);
        });

        expect(authenticatedWalletApi.balance.get).toHaveBeenCalledTimes(1);
    });

    test("should handle API errors", async ({ queryWrapper }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";
        const mockError = new Error("API Error");

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.balance.get).mockResolvedValue({
            data: null,
            error: mockError,
        } as any);

        const { result } = renderHook(() => useGetUserBalance(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.error).toEqual(mockError);
            expect(result.current.userBalance).toBeUndefined();
        });
    });

    test("should refetch when refetch is called", async ({ queryWrapper }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";
        const mockBalance1 = { balance: "1000", formatted: "0.001" };
        const mockBalance2 = { balance: "2000", formatted: "0.002" };

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.balance.get)
            .mockResolvedValueOnce({
                data: mockBalance1,
                error: null,
            } as any)
            .mockResolvedValueOnce({
                data: mockBalance2,
                error: null,
            } as any);

        const { result } = renderHook(() => useGetUserBalance(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.userBalance).toEqual(mockBalance1);
        });

        await result.current.refetch();

        await waitFor(() => {
            expect(result.current.userBalance).toEqual(mockBalance2);
        });

        expect(authenticatedWalletApi.balance.get).toHaveBeenCalledTimes(2);
    });

    test("should not fetch when address is null", async ({ queryWrapper }) => {
        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: null,
        } as any);

        renderHook(() => useGetUserBalance(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(authenticatedWalletApi.balance.get).not.toHaveBeenCalled();
        });
    });

    test("should return null from queryFn when address is not set", async ({
        queryWrapper,
    }) => {
        const mockAddress = "0x1234567890123456789012345678901234567890";

        const { useAccount } = await import("wagmi");
        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);

        vi.mocked(authenticatedWalletApi.balance.get).mockImplementation(
            async () => {
                vi.mocked(useAccount).mockReturnValue({
                    address: undefined,
                } as any);
                return { data: null, error: null } as any;
            }
        );

        const { result } = renderHook(() => useGetUserBalance(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });
    });
});
