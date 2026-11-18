import type { CurrentGameResponse } from "@frak-labs/backend-elysia/domain/game/schemas";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { gameFn, statusFn } = vi.hoisted(() => ({
    gameFn: vi.fn(),
    statusFn: vi.fn(),
}));

vi.mock("@/module/game/hook/useCurrentGame", () => ({
    currentGameQueryOptions: () => ({
        queryKey: ["game", "current"],
        queryFn: gameFn,
    }),
}));
vi.mock("@frak-labs/wallet-shared", () => ({
    referralStatusQueryOptions: () => ({
        queryKey: ["referral", "status", null],
        queryFn: statusFn,
    }),
}));

import { joinRedirectOf, resolveJoinRedirect } from "./joinRedirect";

const current = (game: "open" | "none", participating = false) =>
    ({
        game: game === "open" ? { id: "g1" } : null,
        me: { participating },
    }) as unknown as CurrentGameResponse;

describe("joinRedirectOf", () => {
    it.each([{ code: undefined }, { code: "LOLA10" }])(
        "keeps a non-player on the join screen with code $code",
        ({ code }) => {
            expect(joinRedirectOf(current("open"), code, "MINE01")).toBeNull();
        }
    );

    it("drops the user's own code from the join screen", () => {
        expect(joinRedirectOf(current("open"), "MINE01", "MINE01")).toEqual({
            to: "/game/join",
            search: {},
        });
    });

    it.each([{ code: undefined }, { code: "MINE01" }])(
        "sends a player to the game page with code $code",
        ({ code }) => {
            expect(
                joinRedirectOf(current("open", true), code, "MINE01")
            ).toEqual({
                to: "/game",
            });
        }
    );

    it("sends a player's friend code to the referral page", () => {
        expect(
            joinRedirectOf(current("open", true), "LOLA10", "MINE01")
        ).toEqual({
            to: "/profile/referral/redeem",
            search: { code: "LOLA10" },
        });
    });

    it("sends a player whose referrer is a friend to the game page", () => {
        expect(
            joinRedirectOf(current("open", true), "LOLA10", "MINE01", true)
        ).toEqual({ to: "/game" });
    });

    it("keeps a non-player whose referrer is a friend on the join screen", () => {
        expect(
            joinRedirectOf(current("open"), "LOLA10", "MINE01", true)
        ).toBeNull();
    });

    it("sends the user's own code to their share page when no game is open", () => {
        expect(joinRedirectOf(current("none"), "MINE01", "MINE01")).toEqual({
            to: "/profile/referral/share",
        });
    });

    it.each([
        { code: undefined, ownCode: "MINE01" },
        { code: "LOLA10", ownCode: "MINE01" },
        { code: "LOLA10", ownCode: undefined },
    ])(
        "sends code $code to the referral page when no game is open",
        ({ code, ownCode }) => {
            expect(joinRedirectOf(current("none"), code, ownCode)).toEqual({
                to: "/profile/referral/redeem",
                search: { code },
            });
        }
    );
});

describe("resolveJoinRedirect", () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        // Same freshness as the app's client.
        queryClient = new QueryClient({
            defaultOptions: { queries: { staleTime: 60_000 } },
        });
        gameFn.mockReset().mockResolvedValue(current("open", true));
        statusFn
            .mockReset()
            .mockResolvedValue({ ownedCode: { code: "MINE01" } });
    });

    afterEach(() => {
        onlineManager.setOnline(true);
    });

    it("reads the game and the user's own code to pick the page", async () => {
        await expect(
            resolveJoinRedirect(queryClient, "LOLA10")
        ).resolves.toEqual({
            to: "/profile/referral/redeem",
            search: { code: "LOLA10" },
        });
    });

    it.each([
        { isFrak: false, expected: { to: "/game" } },
        {
            isFrak: true,
            expected: {
                to: "/profile/referral/redeem",
                search: { code: "LOLA10" },
            },
        },
    ])(
        "reads the current referrer (isFrak $isFrak) for a player's friend code",
        async ({ isFrak, expected }) => {
            statusFn.mockResolvedValue({
                ownedCode: { code: "MINE01" },
                crossMerchantReferrer: { code: "PREV01", isFrak },
            });
            await expect(
                resolveJoinRedirect(queryClient, "LOLA10")
            ).resolves.toEqual(expected);
        }
    );

    it("skips the referral status without a code", async () => {
        await expect(
            resolveJoinRedirect(queryClient, undefined)
        ).resolves.toEqual({ to: "/game" });
        expect(statusFn).not.toHaveBeenCalled();
    });

    it("reuses fresh cached data", async () => {
        queryClient.setQueryData(["game", "current"], current("open"));
        await expect(
            resolveJoinRedirect(queryClient, undefined)
        ).resolves.toBeNull();
        expect(gameFn).not.toHaveBeenCalled();
    });

    it("lets the join screen render when the game cannot be read", async () => {
        gameFn.mockRejectedValue(new Error("network"));
        await expect(
            resolveJoinRedirect(queryClient, "LOLA10")
        ).resolves.toBeNull();
    });

    it("treats a failed status read as a friend's code", async () => {
        statusFn.mockRejectedValue(new Error("network"));
        await expect(
            resolveJoinRedirect(queryClient, "MINE01")
        ).resolves.toEqual({
            to: "/profile/referral/redeem",
            search: { code: "MINE01" },
        });
    });

    it("does not wait on the network while offline", async () => {
        onlineManager.setOnline(false);
        await expect(
            resolveJoinRedirect(queryClient, "LOLA10")
        ).resolves.toBeNull();
        expect(gameFn).not.toHaveBeenCalled();
    });
});
