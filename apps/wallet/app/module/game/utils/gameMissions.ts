import type { CurrentGameResponse } from "@frak-labs/backend-elysia/domain/game/schemas";
import type { DefaultTranslationKey } from "@frak-labs/wallet-shared/types";
import { TICKET_AMOUNTS } from "@/module/game/utils/ticketAmounts";

type Me = Pick<
    CurrentGameResponse["me"],
    "ticketsBySource" | "eligible" | "instagram"
>;

export type MissionStatus = "done" | "todo" | "gate";

export type MissionRoute =
    | "/profile/instagram"
    | "/profile/referral/share"
    | "/explorer";

/** A copy key and its interpolation values: the view translates, tests stay locale-free. */
export type MissionText = {
    key: DefaultTranslationKey;
    values?: Record<string, number>;
    /** Sub-phrases the view translates and joins into the `parts` value. */
    parts?: MissionText[];
};

type MissionBase = {
    status: MissionStatus;
    title: DefaultTranslationKey;
    hint: MissionText;
    /** Tickets one occurrence is worth. */
    reward: number;
    /** Tickets this mission has brought so far. */
    earned: number;
};

export type Mission = MissionBase &
    (
        | { id: "join"; route?: undefined }
        | {
              id: "instagram" | "friend" | "purchase";
              route?: MissionRoute;
          }
    );

function instagramOf({ instagram, eligible }: Me): Mission {
    const reward = TICKET_AMOUNTS.instagramCertified;
    const base = { id: "instagram", reward, earned: 0 } as const;
    const route = "/profile/instagram";
    if (instagram === "certified" && eligible) {
        return {
            ...base,
            status: "done",
            earned: reward,
            title: "game.page.missions.instagram.certified.title",
            hint: { key: "game.page.missions.instagram.certified.hint" },
        };
    }
    if (instagram === "declared") {
        return {
            ...base,
            status: "todo",
            route,
            title: "game.page.missions.instagram.declared.title",
            hint: {
                key: "game.page.missions.instagram.declared.hint",
                values: { amount: reward },
            },
        };
    }
    const notFollowing = instagram === "certified";
    return {
        ...base,
        status: "gate",
        route,
        title: notFollowing
            ? "game.page.missions.instagram.notFollowing.title"
            : "game.page.missions.instagram.none.title",
        hint: {
            key: notFollowing
                ? "game.page.missions.instagram.notFollowing.hint"
                : "game.page.missions.instagram.none.hint",
        },
    };
}

function friendOf({ ticketsBySource: t }: Me): Mission {
    const earned = t.referredSignup + t.brandShare;
    const withCode = t.referredSignup / TICKET_AMOUNTS.referredSignup;
    const viaBrand = t.brandShare / TICKET_AMOUNTS.brandShare;
    const parts: MissionText[] = [];
    if (withCode > 0) {
        parts.push({
            key: "game.page.missions.friend.withCode",
            values: { count: withCode },
        });
    }
    if (viaBrand > 0) {
        parts.push({
            key: "game.page.missions.friend.viaBrand",
            values: { count: viaBrand },
        });
    }
    return {
        id: "friend",
        status: earned > 0 ? "done" : "todo",
        route: "/profile/referral/share",
        title: "game.page.missions.friend.title",
        hint:
            earned > 0
                ? { key: "game.page.missions.friend.hintEarned", parts }
                : { key: "game.page.missions.friend.hint" },
        reward: TICKET_AMOUNTS.referredSignup,
        earned,
    };
}

function purchaseOf({ ticketsBySource: t }: Me): Mission {
    const amount = TICKET_AMOUNTS.purchase;
    const earned = t.purchase + t.referredPurchase;
    const own = t.purchase / TICKET_AMOUNTS.purchase;
    const friends = t.referredPurchase / TICKET_AMOUNTS.referredPurchase;
    const parts: MissionText[] = [];
    if (own > 0) {
        parts.push({
            key: "game.page.missions.purchase.own",
            values: { count: own },
        });
    }
    if (friends > 0) {
        parts.push({
            key: "game.page.missions.purchase.friends",
            values: { count: friends },
        });
    }
    return {
        id: "purchase",
        status: earned > 0 ? "done" : "todo",
        route: "/explorer",
        title: "game.page.missions.purchase.title",
        hint:
            earned > 0
                ? {
                      key: "game.page.missions.purchase.hintEarned",
                      parts,
                      values: { amount },
                  }
                : { key: "game.page.missions.purchase.hint" },
        reward: amount,
        earned,
    };
}

/** The four ways to earn tickets, in display order, each with where it stands. */
export function missionsOf(me: Me): Mission[] {
    return [
        {
            id: "join",
            status: "done",
            title: "game.page.missions.join.title",
            hint: { key: "game.page.missions.join.hint" },
            reward: TICKET_AMOUNTS.join,
            earned: TICKET_AMOUNTS.join,
        },
        instagramOf(me),
        friendOf(me),
        purchaseOf(me),
    ];
}

export const missionsDone = (missions: Mission[]) =>
    missions.filter((mission) => mission.status === "done").length;
