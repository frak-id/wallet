import { describe, expect, it } from "vitest";
import type { InteractionType } from "../schemas";
import { mapInteractionType } from "./interactionTypeMapper";

describe("mapInteractionType", () => {
    it("should map referral_arrival to referral", () => {
        expect(mapInteractionType("referral_arrival")).toBe("referral");
    });

    it("should map purchase to purchase", () => {
        expect(mapInteractionType("purchase")).toBe("purchase");
    });

    it("should map wallet_connect to wallet_connect", () => {
        expect(mapInteractionType("wallet_connect")).toBe("wallet_connect");
    });

    it("should map identity_merge to identity_merge", () => {
        expect(mapInteractionType("identity_merge")).toBe("identity_merge");
    });

    it("should return null for unknown types", () => {
        expect(
            mapInteractionType("unknown_type" as unknown as InteractionType)
        ).toBeNull();
    });

    it("should map null to null", () => {
        expect(mapInteractionType(null)).toBeNull();
    });
});
