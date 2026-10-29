import { describe, expect, it } from "vitest";
import { type Mission, missionsDone, missionsOf } from "./gameMissions";

const NONE = {
    join: 1,
    instagramCertified: 0,
    purchase: 0,
    referredPurchase: 0,
    referredSignup: 0,
    brandShare: 0,
};

const me = (
    instagram: "certified" | "declared" | "none",
    eligible: boolean,
    tickets: Partial<typeof NONE> = {}
) => ({ instagram, eligible, ticketsBySource: { ...NONE, ...tickets } });

const byId = (missions: Mission[], id: Mission["id"]) => {
    const mission = missions.find((m) => m.id === id);
    if (!mission) throw new Error(`no ${id} mission`);
    return mission;
};

describe("missionsOf", () => {
    it("lists join, instagram, friend and purchase, with join always done", () => {
        const missions = missionsOf(me("none", false));

        expect(missions.map((m) => m.id)).toEqual([
            "join",
            "instagram",
            "friend",
            "purchase",
        ]);
        expect(byId(missions, "join")).toMatchObject({
            status: "done",
            earned: 1,
        });
        expect(byId(missions, "join").route).toBeUndefined();
        expect(missionsDone(missions)).toBe(1);
    });

    it("marks a certified follower's Instagram done, with no route", () => {
        const instagram = byId(missionsOf(me("certified", true)), "instagram");

        expect(instagram).toMatchObject({
            status: "done",
            earned: 2,
            reward: 2,
        });
        expect(instagram.route).toBeUndefined();
        expect(instagram.title).toBe(
            "game.page.missions.instagram.certified.title"
        );
    });

    it("leaves a declared Instagram to certify for the +2", () => {
        expect(
            byId(missionsOf(me("declared", true)), "instagram")
        ).toMatchObject({
            status: "todo",
            earned: 0,
            route: "/profile/instagram",
            title: "game.page.missions.instagram.declared.title",
            hint: {
                key: "game.page.missions.instagram.declared.hint",
                values: { amount: 2 },
            },
        });
    });

    it("gates a certified account that no longer follows", () => {
        expect(
            byId(missionsOf(me("certified", false)), "instagram")
        ).toMatchObject({
            status: "gate",
            route: "/profile/instagram",
            title: "game.page.missions.instagram.notFollowing.title",
        });
    });

    it("gates a player with no Instagram", () => {
        expect(byId(missionsOf(me("none", false)), "instagram")).toMatchObject({
            status: "gate",
            route: "/profile/instagram",
            title: "game.page.missions.instagram.none.title",
        });
    });

    it("keeps friend and purchase todo, with their route, until a ticket comes in", () => {
        const missions = missionsOf(me("certified", true));

        expect(byId(missions, "friend")).toMatchObject({
            status: "todo",
            earned: 0,
            reward: 1,
            route: "/profile/referral/share",
            hint: { key: "game.page.missions.friend.hint" },
        });
        expect(byId(missions, "purchase")).toMatchObject({
            status: "todo",
            earned: 0,
            reward: 3,
            route: "/explorer",
            hint: { key: "game.page.missions.purchase.hint" },
        });
    });

    it("splits the friends by code and by brand, and keeps the route once done", () => {
        const friend = byId(
            missionsOf(
                me("certified", true, { referredSignup: 2, brandShare: 1 })
            ),
            "friend"
        );

        expect(friend).toMatchObject({
            status: "done",
            earned: 3,
            route: "/profile/referral/share",
        });
        expect(friend.hint).toEqual({
            key: "game.page.missions.friend.hintEarned",
            parts: [
                {
                    key: "game.page.missions.friend.withCode",
                    values: { count: 2 },
                },
                {
                    key: "game.page.missions.friend.viaBrand",
                    values: { count: 1 },
                },
            ],
        });
    });

    it("names only the friend source that earned", () => {
        const friend = byId(
            missionsOf(me("certified", true, { brandShare: 1 })),
            "friend"
        );

        expect(friend.hint.parts).toEqual([
            { key: "game.page.missions.friend.viaBrand", values: { count: 1 } },
        ]);
    });

    it("splits the purchases into own and friends', counted in purchases and earned in tickets", () => {
        const purchase = byId(
            missionsOf(
                me("certified", true, { purchase: 6, referredPurchase: 3 })
            ),
            "purchase"
        );

        expect(purchase).toMatchObject({
            status: "done",
            earned: 9,
            route: "/explorer",
        });
        expect(purchase.hint).toEqual({
            key: "game.page.missions.purchase.hintEarned",
            values: { amount: 3 },
            parts: [
                {
                    key: "game.page.missions.purchase.own",
                    values: { count: 2 },
                },
                {
                    key: "game.page.missions.purchase.friends",
                    values: { count: 1 },
                },
            ],
        });
    });
});
