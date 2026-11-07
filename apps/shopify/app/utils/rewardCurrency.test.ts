import { currentStablecoins } from "@frak-labs/app-essentials";
import { describe, expect, it } from "vitest";
import { campaignRewardCurrency, rewardTokenInfo } from "./rewardCurrency";

describe("campaignRewardCurrency", () => {
    it("follows the token peg, not the shop currency", () => {
        expect(campaignRewardCurrency(currentStablecoins.eure)).toBe("eur");
        expect(campaignRewardCurrency(currentStablecoins.usdc)).toBe("usd");
    });

    it("falls back to EUR without a known token", () => {
        expect(campaignRewardCurrency(undefined)).toBe("eur");
        expect(
            campaignRewardCurrency("0x0000000000000000000000000000000000000001")
        ).toBe("eur");
    });
});

describe("rewardTokenInfo", () => {
    it("names the token and its fiat", () => {
        expect(rewardTokenInfo(currentStablecoins.usdc)).toEqual({
            currency: "usd",
            label: "USDC",
        });
        expect(rewardTokenInfo(currentStablecoins.eure.toLowerCase())).toEqual({
            currency: "eur",
            label: "EURe",
        });
    });

    it("defaults to EURe", () => {
        expect(rewardTokenInfo(undefined)).toEqual({
            currency: "eur",
            label: "EURe",
        });
    });
});
