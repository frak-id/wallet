import { describe, expect, it } from "vitest";
import { buildCampaignRule } from "./campaignCreation";

describe("buildCampaignRule", () => {
    it("should build rule with 50/50 split after 20% commission", () => {
        // CAC 10 → commission 2 → distributable 8 → 4/4
        const rule = buildCampaignRule({ cacBrut: 10, ratio: 50 });

        expect(rule.trigger).toBe("purchase");
        expect(rule.conditions).toEqual([]);
        expect(rule.rewards).toHaveLength(2);
        expect(rule.rewards[0]).toEqual({
            recipient: "referrer",
            type: "token",
            amountType: "fixed",
            amount: 4,
            description: "Referrer reward",
            chaining: {
                deperditionPerLevel: 80,
                maxDepth: 5,
            },
        });
        expect(rule.rewards[1]).toEqual({
            recipient: "referee",
            type: "token",
            amountType: "fixed",
            amount: 4,
            description: "Referee reward",
        });
    });

    it("should build rule with 100% referrer", () => {
        // CAC 10 → commission 2 → distributable 8 → 8 referrer
        const rule = buildCampaignRule({ cacBrut: 10, ratio: 100 });

        expect(rule.rewards).toHaveLength(1);
        expect(rule.rewards[0]?.recipient).toBe("referrer");
        expect(rule.rewards[0]).toHaveProperty("amount", 8);
        expect(rule.rewards[0]).toHaveProperty("chaining", {
            deperditionPerLevel: 80,
            maxDepth: 5,
        });
    });

    it("should build rule with 0% referrer (100% referee)", () => {
        // CAC 10 → commission 2 → distributable 8 → 8 referee
        const rule = buildCampaignRule({ cacBrut: 10, ratio: 0 });

        expect(rule.rewards).toHaveLength(1);
        expect(rule.rewards[0]?.recipient).toBe("referee");
        expect(rule.rewards[0]).toHaveProperty("amount", 8);
    });

    it("should handle non-round ratio splits", () => {
        // CAC 10 → commission 2 → distributable 8 → 5.6 referrer / 2.4 referee
        const rule = buildCampaignRule({ cacBrut: 10, ratio: 70 });

        expect(rule.rewards).toHaveLength(2);
        expect(rule.rewards[0]).toHaveProperty("amount", 5.6);
        expect(rule.rewards[1]).toHaveProperty("amount", 2.4);
    });

    it("should distribute $25 CPA with 50/50 correctly", () => {
        // CAC 25 → commission 5 → distributable 20 → 10/10
        const rule = buildCampaignRule({ cacBrut: 25, ratio: 50 });

        expect(rule.rewards).toHaveLength(2);
        expect(rule.rewards[0]).toHaveProperty("amount", 10);
        expect(rule.rewards[0]?.recipient).toBe("referrer");
        expect(rule.rewards[1]).toHaveProperty("amount", 10);
        expect(rule.rewards[1]?.recipient).toBe("referee");
    });

    it("should include chaining config only on referrer reward", () => {
        const rule = buildCampaignRule({ cacBrut: 10, ratio: 50 });

        const referrer = rule.rewards.find((r) => r.recipient === "referrer");
        const referee = rule.rewards.find((r) => r.recipient === "referee");

        expect(referrer).toHaveProperty("chaining");
        expect(referee).not.toHaveProperty("chaining");
    });

    it("should default maxRewardsPerUser to 1", () => {
        const rule = buildCampaignRule({ cacBrut: 10, ratio: 50 });

        expect(rule.maxRewardsPerUser).toBe(1);
    });
});
