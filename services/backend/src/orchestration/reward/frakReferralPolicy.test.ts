import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { CalculatedReward } from "../../domain/campaign";
import { applyFrakReferralPolicy } from "./frakReferralPolicy";

const FRAK = "frak-group";
const USER = "user-group";
const FRIEND = "friend-group";
const TOKEN = "0x0000000000000000000000000000000000000001" as Address;
const OTHER_TOKEN = "0x0000000000000000000000000000000000000002" as Address;

const reward = (over: Partial<CalculatedReward> = {}): CalculatedReward => ({
    recipient: "referrer",
    recipientIdentityGroupId: FRAK,
    type: "token",
    amount: 5,
    token: TOKEN,
    campaignRuleId: "campaign-a",
    ...over,
});

const refereeReward = reward({
    recipient: "referee",
    recipientIdentityGroupId: USER,
});

const run = (
    rewards: CalculatedReward[],
    over: Partial<Parameters<typeof applyFrakReferralPolicy>[0]> = {}
) =>
    applyFrakReferralPolicy({
        rewards,
        frakIdentityGroupId: FRAK,
        userIdentityGroupId: USER,
        trigger: "purchase",
        directReferrerIsFrak: true,
        bonusAlreadyClaimed: false,
        ...over,
    });

describe("applyFrakReferralPolicy", () => {
    it("redirects Frak's referrer share to the user on the first purchase", () => {
        const result = run([refereeReward, reward()]);

        expect(result).toEqual([
            refereeReward,
            {
                ...reward(),
                recipient: "welcome_bonus",
                recipientIdentityGroupId: USER,
            },
        ]);
    });

    it("drops Frak's share once the bonus is claimed at the merchant", () => {
        expect(
            run([refereeReward, reward()], { bonusAlreadyClaimed: true })
        ).toEqual([refereeReward]);
    });

    it("drops Frak's share on a non-purchase trigger", () => {
        expect(run([reward()], { trigger: "referral" })).toEqual([]);
    });

    it("drops Frak's share when a merchant-scoped referrer shadows Frak", () => {
        expect(run([reward()], { directReferrerIsFrak: false })).toEqual([]);
    });

    it("drops Frak deeper in someone else's chain and keeps the chain", () => {
        const friendShare = reward({
            recipientIdentityGroupId: FRIEND,
            chainDepth: 1,
        });
        const frakShare = reward({ chainDepth: 2, amount: 1 });

        expect(
            run([friendShare, frakShare], { directReferrerIsFrak: false })
        ).toEqual([friendShare]);
        expect(run([friendShare, frakShare])).toEqual([friendShare]);
    });

    it("treats a chained depth-1 share like a direct one", () => {
        const [bonus] = run([reward({ chainDepth: 1 })]);

        expect(bonus?.recipient).toBe("welcome_bonus");
    });

    it("never pays a referee-typed reward addressed to Frak", () => {
        expect(run([reward({ recipient: "referee" })])).toEqual([]);
    });

    it("passes rewards for other recipients through untouched", () => {
        const friendShare = reward({ recipientIdentityGroupId: FRIEND });

        expect(
            run([refereeReward, friendShare], { trigger: "custom" })
        ).toEqual([refereeReward, friendShare]);
    });

    it("keeps one bonus per campaign when several campaigns match", () => {
        const result = run([
            reward({ campaignRuleId: "campaign-a", amount: 5 }),
            reward({ campaignRuleId: "campaign-b", amount: 3 }),
        ]);

        expect(result.map((r) => [r.campaignRuleId, r.amount])).toEqual([
            ["campaign-a", 5],
            ["campaign-b", 3],
        ]);
        expect(result.every((r) => r.recipient === "welcome_bonus")).toBe(true);
    });

    it("merges several shares of one campaign into a single row", () => {
        const result = run([
            reward({ amount: 0.1 }),
            reward({ amount: 0.2 }),
            reward({ amount: 1, token: OTHER_TOKEN }),
        ]);

        expect(result).toHaveLength(1);
        expect(result[0]?.amount).toBe(0.3);
        expect(result[0]?.token).toBe(TOKEN);
    });
});
