import { currentStablecoins } from "@frak-labs/app-essentials";
import { describe, expect, it } from "vitest";
import { campaignRewardCurrency } from "./rewardCurrency";

describe("campaignRewardCurrency", () => {
    it("follows the token peg, not the shop currency", () => {
        expect(campaignRewardCurrency(currentStablecoins.eure)).toBe("eur");
        expect(campaignRewardCurrency(currentStablecoins.usdc)).toBe("usd");
    });

    it("matches addresses case-insensitively", () => {
        expect(
            campaignRewardCurrency(currentStablecoins.usdc.toLowerCase())
        ).toBe("usd");
    });

    it("falls back to EUR without a known token", () => {
        expect(campaignRewardCurrency(undefined)).toBe("eur");
        expect(
            campaignRewardCurrency("0x0000000000000000000000000000000000000001")
        ).toBe("eur");
    });
});
