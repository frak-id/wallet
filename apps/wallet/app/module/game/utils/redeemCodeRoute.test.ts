import { afterEach, describe, expect, it, vi } from "vitest";

const mockGame = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/module/game/config", () => ({ frakGame: mockGame }));

import { redeemCodeRoute } from "./redeemCodeRoute";

describe("redeemCodeRoute", () => {
    afterEach(() => {
        mockGame.enabled = false;
    });

    it("sends a shared code to the game join screen while the game is on", () => {
        mockGame.enabled = true;

        expect(redeemCodeRoute("FRAK26")).toEqual({
            to: "/game/join",
            search: { code: "FRAK26" },
        });
    });

    it("keeps the referral redeem page while the game is off", () => {
        expect(redeemCodeRoute("FRAK26")).toEqual({
            to: "/profile/referral/redeem",
            search: { code: "FRAK26" },
        });
    });
});
