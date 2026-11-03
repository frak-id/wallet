import { describe, expect, it, vi } from "vitest";

vi.mock("@/module/game/utils/ticketAmounts", () => ({
    TICKET_AMOUNTS: {
        join: 1,
        instagramCertified: 2,
        purchase: 3,
        referredPurchase: 3,
        referredSignup: 2,
        brandShare: 2,
    },
}));

import { missionsOf } from "./gameMissions";

describe("missionsOf with 2 tickets per friend", () => {
    it("counts friends, not their tickets", () => {
        const friend = missionsOf({
            eligible: true,
            instagram: "certified",
            ticketsBySource: {
                join: 1,
                instagramCertified: 0,
                purchase: 0,
                referredPurchase: 0,
                referredSignup: 4,
                brandShare: 2,
            },
        }).find((mission) => mission.id === "friend");

        expect(friend?.earned).toBe(6);
        expect(friend?.hint).toMatchObject({
            parts: [{ values: { count: 2 } }, { values: { count: 1 } }],
        });
    });
});
