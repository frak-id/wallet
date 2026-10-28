/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import type { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { vi } from "vitest";
import { currentGameKeys } from "@/module/game/hook/useCurrentGame";
import { gameHistoryKeys } from "@/module/game/hook/useGameHistory";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    put: vi.fn(),
    remove: vi.fn(),
    check: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return {
        ...actual,
        authenticatedWalletApi: {
            instagram: {
                get: mocks.get,
                declaration: { put: mocks.put, delete: mocks.remove },
                check: { post: mocks.check },
            },
        },
    };
});

import { balanceKey, claimableKey, rewardsKey } from "@frak-labs/wallet-shared";
import {
    DM_POLL_INTERVAL_MS,
    DM_POLL_TIMEOUT_MS,
    instagramKeys,
    useAwaitInstagramDm,
    useCheckInstagram,
    useDeclareInstagram,
    useRefreshInstagramFollow,
} from "./useInstagramLink";

const DECLARED = {
    link: null,
    declaration: { username: "lea", declaredAt: new Date() },
};
const CERTIFIED = {
    link: { username: "lea", follows: true, checkedAt: new Date() },
    declaration: null,
};
const NOTHING = { link: null, declaration: null };
const UNFOLLOWED = {
    link: { username: "lea", follows: false, checkedAt: new Date() },
    declaration: null,
};

function mountRefresh(
    queryWrapper: {
        client: QueryClient;
        wrapper: ComponentType<{ children: ReactNode }>;
    },
    cached: unknown
) {
    queryWrapper.client.setQueryData(instagramKeys.status, cached);
    mocks.get.mockReturnValue(new Promise(() => undefined));
    renderHook(() => useRefreshInstagramFollow(), {
        wrapper: queryWrapper.wrapper,
    });
}

describe("useInstagramLink", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("a certification re-reads the game and every reward balance", async ({
        queryWrapper,
    }) => {
        mocks.check.mockResolvedValue({ data: CERTIFIED, error: null });
        const setData = vi.spyOn(queryWrapper.client, "setQueryData");
        const invalidate = vi.spyOn(queryWrapper.client, "invalidateQueries");
        const { result } = renderHook(() => useCheckInstagram(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => result.current.mutate());

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(setData).toHaveBeenCalledWith(instagramKeys.status, CERTIFIED);
        for (const queryKey of [
            currentGameKeys.all,
            gameHistoryKeys.all,
            rewardsKey.all,
            claimableKey.baseKey,
            balanceKey.baseKey,
        ]) {
            expect(invalidate).toHaveBeenCalledWith({ queryKey });
        }
    });

    describe("re-checking the follow when a page opens", () => {
        test("a certified link is checked once on mount", async ({
            queryWrapper,
        }) => {
            mocks.check.mockResolvedValue({ data: CERTIFIED, error: null });

            mountRefresh(queryWrapper, CERTIFIED);

            await waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(1));
            await new Promise((resolve) => setTimeout(resolve, 20));
            expect(mocks.check).toHaveBeenCalledTimes(1);
        });

        test("a status read in flight before the check does not bring back the old follow", async ({
            queryWrapper,
        }) => {
            let finishRead: (value: unknown) => void = () => undefined;
            mocks.get.mockReturnValue(
                new Promise((resolve) => {
                    finishRead = resolve;
                })
            );
            mocks.check.mockResolvedValue({ data: UNFOLLOWED, error: null });
            queryWrapper.client.setQueryData(instagramKeys.status, CERTIFIED);

            renderHook(() => useRefreshInstagramFollow(), {
                wrapper: queryWrapper.wrapper,
            });
            await waitFor(() =>
                expect(
                    queryWrapper.client.getQueryData(instagramKeys.status)
                ).toEqual(UNFOLLOWED)
            );
            await act(async () => {
                finishRead({ data: CERTIFIED, error: null });
                await new Promise((resolve) => setTimeout(resolve, 20));
            });

            expect(
                queryWrapper.client.getQueryData(instagramKeys.status)
            ).toEqual(UNFOLLOWED);
        });

        test("an unfollow updates the status and re-reads the game", async ({
            queryWrapper,
        }) => {
            mocks.check.mockResolvedValue({ data: UNFOLLOWED, error: null });
            const invalidate = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );

            mountRefresh(queryWrapper, CERTIFIED);

            await waitFor(() =>
                expect(
                    queryWrapper.client.getQueryData(instagramKeys.status)
                ).toEqual(UNFOLLOWED)
            );
            expect(invalidate).toHaveBeenCalledWith({
                queryKey: currentGameKeys.all,
            });
        });

        test("an unchanged follow leaves the game alone", async ({
            queryWrapper,
        }) => {
            mocks.check.mockResolvedValue({ data: CERTIFIED, error: null });
            const invalidate = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );

            mountRefresh(queryWrapper, CERTIFIED);

            await waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(1));
            await waitFor(() =>
                expect(
                    queryWrapper.client.getQueryState(instagramKeys.recheck)
                        ?.status
                ).toBe("success")
            );
            expect(invalidate).not.toHaveBeenCalled();
        });

        for (const [who, cached] of [
            ["declared only", DECLARED],
            ["unlinked", NOTHING],
        ] as const) {
            test(`a player who is ${who} is never checked`, async ({
                queryWrapper,
            }) => {
                mountRefresh(queryWrapper, cached);

                await new Promise((resolve) => setTimeout(resolve, 20));
                expect(mocks.check).not.toHaveBeenCalled();
            });
        }

        test("a refused check keeps the stored status", async ({
            queryWrapper,
        }) => {
            mocks.check.mockResolvedValue({
                data: null,
                error: {
                    status: 502,
                    value: { code: "INSTAGRAM_UNAVAILABLE" },
                },
            });

            mountRefresh(queryWrapper, CERTIFIED);

            await waitFor(() =>
                expect(
                    queryWrapper.client.getQueryState(instagramKeys.recheck)
                        ?.status
                ).toBe("error")
            );
            expect(
                queryWrapper.client.getQueryData(instagramKeys.status)
            ).toEqual(CERTIFIED);
        });
    });

    test("a declaration caches the returned status", async ({
        queryWrapper,
    }) => {
        mocks.put.mockResolvedValue({ data: DECLARED, error: null });
        const setData = vi.spyOn(queryWrapper.client, "setQueryData");
        const { result } = renderHook(() => useDeclareInstagram(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => result.current.declare.mutate("@lea"));

        await waitFor(() =>
            expect(result.current.declare.isSuccess).toBe(true)
        );
        expect(mocks.put).toHaveBeenCalledWith({ username: "@lea" });
        expect(setData).toHaveBeenCalledWith(instagramKeys.status, DECLARED);
    });

    test("a declaration refused as already certified re-reads the status", async ({
        queryWrapper,
    }) => {
        mocks.put.mockResolvedValue({
            data: null,
            error: {
                status: 409,
                value: { code: "INSTAGRAM_ALREADY_CERTIFIED" },
            },
        });
        const invalidate = vi.spyOn(queryWrapper.client, "invalidateQueries");
        const { result } = renderHook(() => useDeclareInstagram(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => result.current.declare.mutate("lea"));

        await waitFor(() => expect(result.current.declare.isError).toBe(true));
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: instagramKeys.status,
        });
    });

    describe("waiting for the DM", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        test("re-reads the status until the webhook links the account", async ({
            queryWrapper,
        }) => {
            mocks.check.mockResolvedValue({ data: NOTHING, error: null });
            mocks.get
                .mockResolvedValueOnce({ data: NOTHING, error: null })
                .mockResolvedValueOnce({ data: CERTIFIED, error: null });
            const setData = vi.spyOn(queryWrapper.client, "setQueryData");
            const { result } = renderHook(() => useAwaitInstagramDm(), {
                wrapper: queryWrapper.wrapper,
            });

            const done = result.current.mutateAsync();
            await vi.advanceTimersByTimeAsync(2 * DM_POLL_INTERVAL_MS);

            await expect(done).resolves.toEqual(CERTIFIED);
            expect(mocks.get).toHaveBeenCalledTimes(2);
            expect(setData).toHaveBeenCalledWith(
                instagramKeys.status,
                CERTIFIED
            );
        });

        test("gives up after a minute without the message", async ({
            queryWrapper,
        }) => {
            mocks.check.mockResolvedValue({ data: NOTHING, error: null });
            mocks.get.mockResolvedValue({ data: NOTHING, error: null });
            const { result } = renderHook(() => useAwaitInstagramDm(), {
                wrapper: queryWrapper.wrapper,
            });

            const done = result.current.mutateAsync();
            await vi.advanceTimersByTimeAsync(
                DM_POLL_TIMEOUT_MS + DM_POLL_INTERVAL_MS
            );

            await expect(done).resolves.toEqual(NOTHING);
            const polls = mocks.get.mock.calls.length;
            expect(polls).toBe(DM_POLL_TIMEOUT_MS / DM_POLL_INTERVAL_MS);
            await vi.advanceTimersByTimeAsync(DM_POLL_INTERVAL_MS * 3);
            expect(mocks.get).toHaveBeenCalledTimes(polls);
        });

        test("stops at once when the DM arrived before the tap", async ({
            queryWrapper,
        }) => {
            mocks.check.mockResolvedValue({ data: CERTIFIED, error: null });
            const { result } = renderHook(() => useAwaitInstagramDm(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(result.current.mutateAsync()).resolves.toEqual(
                CERTIFIED
            );
            expect(mocks.get).not.toHaveBeenCalled();
        });
    });
});
