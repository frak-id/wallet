import { describe, expect, it } from "vitest";
import { redeemCodeRoute } from "./redeemCodeRoute";

describe("redeemCodeRoute", () => {
    it("sends a shared code to the game join screen", () => {
        expect(redeemCodeRoute("FRAK26")).toEqual({
            to: "/game/join",
            search: { code: "FRAK26" },
        });
    });
});
