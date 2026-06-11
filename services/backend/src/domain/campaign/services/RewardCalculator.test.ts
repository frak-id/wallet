import type { PricingRepository } from "@backend-infrastructure";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
    PercentageRewardDefinition,
    PurchaseContext,
    ReferralChainMember,
    RewardDefinition,
    RuleContext,
} from "../types";
import { RewardCalculator } from "./RewardCalculator";
import type { RuleConditionEvaluator } from "./RuleConditionEvaluator";

const conditionEvaluator = {
    evaluate: vi.fn(),
    getFieldValue: vi.fn(),
} as unknown as RuleConditionEvaluator;

const pricingRepository = {
    convertFiatToTokenAmount: vi.fn(),
} as unknown as PricingRepository;

const calculator = new RewardCalculator(conditionEvaluator, pricingRepository);

const baseContext: RuleContext = {
    user: {
        identityGroupId: "user-1",
        walletAddress: null,
    },
    time: {
        dayOfWeek: 1,
        hourOfDay: 12,
        date: "2025-01-01",
        timestamp: 0,
    },
    attribution: {
        source: "referral_link",
        touchpointId: null,
        referrerIdentityGroupId: "referrer-1",
    },
};

describe("RewardCalculator.calculateAll — lockup propagation", () => {
    it("attaches defaultLockupSeconds to a simple referee reward", async () => {
        const rewards: RewardDefinition[] = [
            {
                recipient: "referee",
                type: "token",
                amountType: "fixed",
                amount: 50,
            },
        ];

        const { calculated } = await calculator.calculateAll(
            rewards,
            baseContext,
            "campaign-1",
            undefined,
            undefined,
            7 * 86_400
        );

        expect(calculated).toHaveLength(1);
        expect(calculated[0].lockupSeconds).toBe(7 * 86_400);
    });

    it("propagates defaultLockupSeconds to every member of a chained referrer reward", async () => {
        const referralChain: ReferralChainMember[] = [
            { identityGroupId: "ref-1", depth: 1 },
            { identityGroupId: "ref-2", depth: 2 },
            { identityGroupId: "ref-3", depth: 3 },
        ];
        const rewards: RewardDefinition[] = [
            {
                recipient: "referrer",
                type: "token",
                amountType: "fixed",
                amount: 100,
                chaining: {
                    deperditionPerLevel: 50,
                    maxDepth: 3,
                },
            },
        ];

        const { calculated } = await calculator.calculateAll(
            rewards,
            baseContext,
            "campaign-1",
            referralChain,
            undefined,
            14 * 86_400
        );

        expect(calculated.length).toBeGreaterThan(0);
        for (const r of calculated) {
            expect(r.lockupSeconds).toBe(14 * 86_400);
        }
    });

    it("leaves lockupSeconds undefined when no rule-level default is set", async () => {
        const rewards: RewardDefinition[] = [
            {
                recipient: "referee",
                type: "token",
                amountType: "fixed",
                amount: 10,
            },
        ];

        const { calculated } = await calculator.calculateAll(
            rewards,
            baseContext,
            "campaign-1"
        );

        expect(calculated).toHaveLength(1);
        expect(calculated[0].lockupSeconds).toBeUndefined();
    });
});

describe("RewardCalculator.calculateAll — percentage FX normalisation", () => {
    const TOKEN = "0x0000000000000000000000000000000000000abc" as Address;
    const MERCHANT_DEFAULT =
        "0x0000000000000000000000000000000000000def" as Address;

    const purchase = (currency: string, amount = 100): PurchaseContext => ({
        orderId: "order-1",
        amount,
        currency,
        items: [],
    });

    const percentageReward = (
        overrides: Partial<PercentageRewardDefinition> = {}
    ): RewardDefinition => ({
        recipient: "referee",
        type: "token",
        amountType: "percentage",
        percent: 5,
        percentOf: "purchase_amount",
        token: TOKEN,
        ...overrides,
    });

    beforeEach(() => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockReset();
    });

    it("converts the fiat order share into token units via the pricing repo", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            {
                converted: true,
                tokenAmount: 4.63,
            }
        );

        const { calculated, deferForUnpriceableReward } =
            await calculator.calculateAll(
                [percentageReward()],
                { ...baseContext, purchase: purchase("usd") },
                "campaign-1"
            );

        expect(deferForUnpriceableReward).toBe(false);
        expect(calculated).toHaveLength(1);
        expect(calculated[0].amount).toBe(4.63);
        expect(calculated[0].token).toBe(TOKEN);
        expect(pricingRepository.convertFiatToTokenAmount).toHaveBeenCalledWith(
            {
                token: TOKEN,
                fiatAmount: 5,
                currency: "usd",
            }
        );
    });

    it("defers the whole evaluation when no FX rate covers the currency", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            {
                converted: false,
                reason: "fx_rate_unavailable",
            }
        );

        const { calculated, deferForUnpriceableReward, deferReason } =
            await calculator.calculateAll(
                [percentageReward()],
                { ...baseContext, purchase: purchase("jpy") },
                "campaign-1"
            );

        expect(deferForUnpriceableReward).toBe(true);
        expect(deferReason).toContain("fx_rate_unavailable");
        expect(deferReason).toContain("jpy");
        expect(calculated).toHaveLength(0);
    });

    it("defers when the token price is unavailable", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            {
                converted: false,
                reason: "token_price_unavailable",
            }
        );

        const { deferForUnpriceableReward } = await calculator.calculateAll(
            [percentageReward()],
            { ...baseContext, purchase: purchase("eur") },
            "campaign-1"
        );

        expect(deferForUnpriceableReward).toBe(true);
    });

    it("caps with maxAmount in token units after conversion", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            {
                converted: true,
                tokenAmount: 50,
            }
        );

        const { calculated } = await calculator.calculateAll(
            [percentageReward({ maxAmount: 10 })],
            { ...baseContext, purchase: purchase("eur") },
            "campaign-1"
        );

        expect(calculated[0].amount).toBe(10);
    });

    it("raises to minAmount in token units after conversion", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            {
                converted: true,
                tokenAmount: 0.5,
            }
        );

        const { calculated } = await calculator.calculateAll(
            [percentageReward({ minAmount: 2 })],
            { ...baseContext, purchase: purchase("eur") },
            "campaign-1"
        );

        expect(calculated[0].amount).toBe(2);
    });

    it("prices against the merchant default token when the reward pins none", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            {
                converted: true,
                tokenAmount: 5,
            }
        );

        const { calculated } = await calculator.calculateAll(
            [percentageReward({ token: undefined })],
            { ...baseContext, purchase: purchase("eur") },
            "campaign-1",
            undefined,
            undefined,
            undefined,
            MERCHANT_DEFAULT
        );

        expect(pricingRepository.convertFiatToTokenAmount).toHaveBeenCalledWith(
            expect.objectContaining({ token: MERCHANT_DEFAULT })
        );
        expect(calculated[0].token).toBe(MERCHANT_DEFAULT);
    });

    it("errors without deferring when no token can be resolved", async () => {
        const { calculated, errors, deferForUnpriceableReward } =
            await calculator.calculateAll(
                [percentageReward({ token: undefined })],
                { ...baseContext, purchase: purchase("eur") },
                "campaign-1"
            );

        expect(calculated).toHaveLength(0);
        expect(deferForUnpriceableReward).toBe(false);
        expect(errors[0]).toContain("No token");
        expect(
            pricingRepository.convertFiatToTokenAmount
        ).not.toHaveBeenCalled();
    });
});
