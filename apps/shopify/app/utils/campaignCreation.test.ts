import { describe, expect, it } from "vitest";
import { buildCampaignRule } from "./campaignCreation";

describe("buildCampaignRule", () => {
    it("should build rule with 50/50 split", () => {
        const rule = buildCampaignRule({ cacBrut: 10, ratio: 50 });

        expect(rule.trigger).toBe("purchase");
        expect(rule.conditions).toEqual([]);
        expect(rule.rewards).toHaveLength(2);
        expect(rule.rewards[0]).toEqual({
            recipient: "referrer",
            type: "token",
            amountType: "fixed",
            amount: 5,
            description: "Referrer reward",
        });
        expect(rule.rewards[1]).toEqual({
            recipient: "referee",
            type: "token",
            amountType: "fixed",
            amount: 5,
            description: "Referee reward",
        });
    });

    it("should build rule with 100% referrer", () => {
        const rule = buildCampaignRule({ cacBrut: 10, ratio: 100 });

        expect(rule.rewards).toHaveLength(1);
        expect(rule.rewards[0]?.recipient).toBe("referrer");
        expect(rule.rewards[0]).toHaveProperty("amount", 10);
    });

    it("should build rule with 0% referrer (100% referee)", () => {
        const rule = buildCampaignRule({ cacBrut: 10, ratio: 0 });

        expect(rule.rewards).toHaveLength(1);
        expect(rule.rewards[0]?.recipient).toBe("referee");
        expect(rule.rewards[0]).toHaveProperty("amount", 10);
    });

    it("should handle non-round ratio splits", () => {
        const rule = buildCampaignRule({ cacBrut: 10, ratio: 70 });

        expect(rule.rewards).toHaveLength(2);
        expect(rule.rewards[0]).toHaveProperty("amount", 7);
        expect(rule.rewards[1]).toHaveProperty("amount", 3);
    });
});
