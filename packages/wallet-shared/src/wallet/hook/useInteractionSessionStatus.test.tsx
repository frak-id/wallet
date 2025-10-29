import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { useInteractionSessionStatus } from "./useInteractionSessionStatus";

vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

vi.mock("../../interaction/action/interactionSession", () => ({
    getSessionStatus: vi.fn(),
}));

vi.mock("../../stores/walletStore", () => ({
    walletStore: {
        getState: vi.fn(),
    },
}));

describe("useInteractionSessionStatus", () => {
    beforeEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test("should not fetch when no address is provided", async ({
        queryWrapper,
    }) => {
        const { useAccount } = await import("wagmi");

        vi.mocked(useAccount).mockReturnValue({ address: undefined } as any);

        const { result } = renderHook(() => useInteractionSessionStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.data).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.fetchStatus).toBe("idle");
    });

    test("should use wagmi address when no param address is provided", async ({
        queryWrapper,
        mockAddress,
        mockInteractionSession,
    }) => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const mockSession = mockInteractionSession;

        const setInteractionSession = vi.fn();

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockResolvedValue(mockSession);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession,
        } as any);

        const { result } = renderHook(() => useInteractionSessionStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockSession);
        expect(getSessionStatus).toHaveBeenCalledWith({
            wallet: mockAddress,
        });
        expect(setInteractionSession).toHaveBeenCalledWith(mockSession);
    });

    test("should use param address over wagmi address", async ({
        queryWrapper,
        mockAddress,
        mockInteractionSession,
    }) => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const { createMockAddress } = await import("../../test/factories");
        const differentAddress = createMockAddress("abcdef");
        const mockSession = {
            ...mockInteractionSession,
            sessionStart: Date.now() - 3600000,
            sessionEnd: Date.now(),
        };

        const setInteractionSession = vi.fn();

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockResolvedValue(mockSession);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession,
        } as any);

        const { result } = renderHook(
            () => useInteractionSessionStatus({ address: differentAddress }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockSession);
        expect(getSessionStatus).toHaveBeenCalledWith({
            wallet: differentAddress,
        });
    });

    test("should return null when session status is null", async ({
        queryWrapper,
        mockAddress,
    }) => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const setInteractionSession = vi.fn();

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockResolvedValue(null);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession,
        } as any);

        const { result } = renderHook(() => useInteractionSessionStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBeNull();
        expect(setInteractionSession).toHaveBeenCalledWith(null);
    });

    test("should update wallet store with session status", async ({
        queryWrapper,
        mockAddress,
        mockInteractionSession,
    }) => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const mockSession = mockInteractionSession;

        const setInteractionSession = vi.fn();

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockResolvedValue(mockSession);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession,
        } as any);

        const { result } = renderHook(() => useInteractionSessionStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(setInteractionSession).toHaveBeenCalledTimes(1);
        expect(setInteractionSession).toHaveBeenCalledWith(mockSession);
    });

    test("should respect custom query options", async ({
        queryWrapper,
        mockAddress,
        mockInteractionSession,
    }) => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const mockSession = mockInteractionSession;

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockResolvedValue(mockSession);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession: vi.fn(),
        } as any);

        const { result } = renderHook(
            () =>
                useInteractionSessionStatus({
                    query: {
                        staleTime: 10000,
                        gcTime: 20000,
                    },
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockSession);
    });

    test("should refetch session status when refetch is called", async ({
        queryWrapper,
        mockAddress,
        mockInteractionSession,
    }) => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const mockSession1 = mockInteractionSession;
        const mockSession2 = {
            ...mockInteractionSession,
            sessionEnd: Date.now(),
        };

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus)
            .mockResolvedValueOnce(mockSession1)
            .mockResolvedValueOnce(mockSession2);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession: vi.fn(),
        } as any);

        const { result } = renderHook(() => useInteractionSessionStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.sessionEnd).toBeGreaterThan(Date.now());

        await result.current.refetch();

        await waitFor(() => {
            expect(result.current.data?.sessionEnd).toBeLessThanOrEqual(
                Date.now()
            );
        });

        expect(getSessionStatus).toHaveBeenCalledTimes(2);
    });

    test("should handle errors from getSessionStatus", async ({
        queryWrapper,
        mockAddress,
    }) => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const mockError = new Error("Failed to fetch session status");

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockRejectedValue(mockError);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession: vi.fn(),
        } as any);

        const { result } = renderHook(() => useInteractionSessionStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(mockError);
    });

    test("should be disabled when address changes from defined to undefined", async ({
        queryWrapper,
        mockAddress,
        mockInteractionSession,
    }) => {
        const { useAccount } = await import("wagmi");
        const { getSessionStatus } = await import(
            "../../interaction/action/interactionSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const mockSession = mockInteractionSession;

        vi.mocked(useAccount).mockReturnValue({ address: mockAddress } as any);
        vi.mocked(getSessionStatus).mockResolvedValue(mockSession);
        vi.mocked(walletStore.getState).mockReturnValue({
            setInteractionSession: vi.fn(),
        } as any);

        const { result, rerender } = renderHook(
            () => useInteractionSessionStatus(),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        // Change address to undefined
        vi.mocked(useAccount).mockReturnValue({ address: undefined } as any);
        rerender();

        expect(result.current.fetchStatus).toBe("idle");
    });
});
