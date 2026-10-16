/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { fail, moneriumStatus, ok } from "@/tests/moneriumFixtures";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/module/monerium/utils/moneriumConfig", () => ({
    isMoneriumEnabled: true,
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return {
        ...actual,
        authenticatedWalletApi: { monerium: { status: { get: mocks.get } } },
    };
});

import {
    useMoneriumStatus,
    useMoneriumStatusRefresh,
} from "./useMoneriumStatus";

const VERIFYING = moneriumStatus({
    profile: { id: "p", kind: "personal", state: "pending" },
});

describe("useMoneriumStatusRefresh", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.get.mockResolvedValue(fail(502));
    });

    test("asks the backend to re-read Monerium and caches the answer", async ({
        queryWrapper,
    }) => {
        mocks.get.mockResolvedValue(ok(VERIFYING));
        const { result } = renderHook(() => useMoneriumStatusRefresh(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.refreshAsync();

        expect(mocks.get).toHaveBeenCalledWith({ query: { refresh: true } });
        expect(queryWrapper.client.getQueryData(moneriumKey.status)).toEqual(
            VERIFYING
        );
    });

    test("exposes the refresh failure", async ({ queryWrapper }) => {
        const { result } = renderHook(() => useMoneriumStatusRefresh(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(result.current.refreshAsync()).rejects.toThrow();
        await waitFor(() => expect(result.current.refreshError).toBeTruthy());
    });

    test("a newer status from a poll clears the refresh failure", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useMoneriumStatusRefresh(), {
            wrapper: queryWrapper.wrapper,
        });
        await expect(result.current.refreshAsync()).rejects.toThrow();
        await waitFor(() => expect(result.current.refreshError).toBeTruthy());

        await new Promise((resolve) => setTimeout(resolve, 2));
        act(() => {
            queryWrapper.client.setQueryData(moneriumKey.status, VERIFYING);
        });

        await waitFor(() => expect(result.current.refreshError).toBeNull());
    });
});

describe("useMoneriumStatus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.get.mockResolvedValue(ok(VERIFYING));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("reads the cached status without asking for a refresh", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useMoneriumStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.status).toEqual(VERIFYING));
        expect(mocks.get).toHaveBeenCalledWith({ query: {} });
    });

    test("polls a pending status when asked to", async ({ queryWrapper }) => {
        vi.useFakeTimers();
        renderHook(() => useMoneriumStatus({ poll: true }), {
            wrapper: queryWrapper.wrapper,
        });
        await vi.advanceTimersByTimeAsync(0);
        expect(mocks.get).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(30_000);
        expect(mocks.get).toHaveBeenCalledTimes(2);
    });

    test("does not poll unless asked to", async ({ queryWrapper }) => {
        vi.useFakeTimers();
        renderHook(() => useMoneriumStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await vi.advanceTimersByTimeAsync(120_000);
        expect(mocks.get).toHaveBeenCalledTimes(1);
    });

    test("does not poll once the status needs nothing more", async ({
        queryWrapper,
    }) => {
        vi.useFakeTimers();
        mocks.get.mockResolvedValue(ok(moneriumStatus()));
        renderHook(() => useMoneriumStatus({ poll: true }), {
            wrapper: queryWrapper.wrapper,
        });

        await vi.advanceTimersByTimeAsync(120_000);
        expect(mocks.get).toHaveBeenCalledTimes(1);
    });
});
