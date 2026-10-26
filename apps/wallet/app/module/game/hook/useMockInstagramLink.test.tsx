/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { currentGameKeys } from "@/module/game/hook/useCurrentGame";
import { instagramKeys } from "@/module/game/hook/useInstagramLink";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({ put: vi.fn(), remove: vi.fn() }));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return {
        ...actual,
        authenticatedWalletApi: {
            instagram: { mock: { put: mocks.put, delete: mocks.remove } },
        },
    };
});

import { useMockInstagramLink } from "./useMockInstagramLink";

const LINK = {
    username: "lea",
    follows: true,
    checkedAt: new Date("2026-10-26T10:00:00Z"),
};

describe("useMockInstagramLink", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.put.mockResolvedValue({ data: { link: LINK }, error: null });
        mocks.remove.mockResolvedValue({ data: { link: null }, error: null });
    });

    test("sends the handle and follow state, then caches the link and refreshes the game", async ({
        queryWrapper,
    }) => {
        const setData = vi.spyOn(queryWrapper.client, "setQueryData");
        const invalidate = vi.spyOn(queryWrapper.client, "invalidateQueries");
        const { result } = renderHook(() => useMockInstagramLink(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() =>
            result.current.link.mutate({ username: "@Lea", follows: true })
        );

        await waitFor(() => expect(result.current.link.isSuccess).toBe(true));
        expect(mocks.put).toHaveBeenCalledWith({
            username: "@Lea",
            follows: true,
        });
        expect(setData).toHaveBeenCalledWith(instagramKeys.link, LINK);
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: currentGameKeys.all,
        });
    });

    test("revoking empties the cached link and refreshes the game", async ({
        queryWrapper,
    }) => {
        const setData = vi.spyOn(queryWrapper.client, "setQueryData");
        const invalidate = vi.spyOn(queryWrapper.client, "invalidateQueries");
        const { result } = renderHook(() => useMockInstagramLink(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => result.current.revoke.mutate());

        await waitFor(() => expect(result.current.revoke.isSuccess).toBe(true));
        expect(setData).toHaveBeenCalledWith(instagramKeys.link, null);
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: currentGameKeys.all,
        });
    });

    test("surfaces the backend error and leaves the cache alone", async ({
        queryWrapper,
    }) => {
        const refused = {
            status: 409,
            value: { code: "INSTAGRAM_ALREADY_LINKED" },
        };
        mocks.put.mockResolvedValue({ data: null, error: refused });
        const setData = vi.spyOn(queryWrapper.client, "setQueryData");
        const invalidate = vi.spyOn(queryWrapper.client, "invalidateQueries");
        const { result } = renderHook(() => useMockInstagramLink(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() =>
            result.current.link.mutate({ username: "lea", follows: true })
        );

        await waitFor(() => expect(result.current.link.isError).toBe(true));
        expect(result.current.link.error).toBe(refused);
        expect(setData).not.toHaveBeenCalled();
        expect(invalidate).not.toHaveBeenCalled();
    });
});
