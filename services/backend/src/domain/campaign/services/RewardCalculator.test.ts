import type { PricingRepository } from "@backend-infrastructure";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
    PercentageRewardDefinition,
    PurchaseContext,
    ReferralChainMember,
    RewardDefinition,
    RuleContext,
    TieredRewardDefinition,
} from "../types";
import { RewardCalculator } from "./RewardCalculator";
import { RuleConditionEvaluator } from "./RuleConditionEvaluator";

const conditionEvaluator = new RuleConditionEvaluator();

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

    it("lets maxAmount win over a higher minAmount instead of uncapping", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            {
                converted: true,
                tokenAmount: 3,
            }
        );

        const { calculated } = await calculator.calculateAll(
            [percentageReward({ minAmount: 100, maxAmount: 5 })],
            { ...baseContext, purchase: purchase("eur") },
            "campaign-1"
        );

        expect(calculated[0].amount).toBe(5);
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

describe("RewardCalculator.calculateAll — tiered purchase.amount normalisation", () => {
    const TOKEN = "0x0000000000000000000000000000000000000abc" as Address;

    const purchase = (currency: string, amount: number): PurchaseContext => ({
        orderId: "order-1",
        amount,
        currency,
        items: [],
    });

    const tieredReward = (
        overrides: Partial<TieredRewardDefinition> = {}
    ): RewardDefinition => ({
        recipient: "referee",
        type: "token",
        amountType: "tiered",
        tierField: "purchase.amount",
        tiers: [
            { minValue: 0, maxValue: 99, amount: 1 },
            { minValue: 100, maxValue: 499, amount: 5 },
            { minValue: 500, amount: 20 },
        ],
        token: TOKEN,
        ...overrides,
    });

    beforeEach(() => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockReset();
    });

    it("matches tiers against the token-converted amount, not raw fiat", async () => {
        // ¥50,000 is only ~310 token units: mid tier, not the top one
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: true, tokenAmount: 310 }
        );

        const { calculated } = await calculator.calculateAll(
            [tieredReward()],
            { ...baseContext, purchase: purchase("jpy", 50_000) },
            "campaign-1"
        );

        expect(pricingRepository.convertFiatToTokenAmount).toHaveBeenCalledWith(
            {
                token: TOKEN,
                fiatAmount: 50_000,
                currency: "jpy",
            }
        );
        expect(calculated).toHaveLength(1);
        expect(calculated[0].amount).toBe(5);
    });

    it("defers when the tier amount cannot be converted", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: false, reason: "fx_rate_unavailable" }
        );

        const { calculated, deferForUnpriceableReward, deferReason } =
            await calculator.calculateAll(
                [tieredReward()],
                { ...baseContext, purchase: purchase("jpy", 50_000) },
                "campaign-1"
            );

        expect(deferForUnpriceableReward).toBe(true);
        expect(deferReason).toContain("tiered reward");
        expect(calculated).toHaveLength(0);
    });

    it("falls back to the merchant default token for conversion", async () => {
        const MERCHANT_DEFAULT =
            "0x0000000000000000000000000000000000000def" as Address;
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: true, tokenAmount: 600 }
        );

        const { calculated } = await calculator.calculateAll(
            [tieredReward({ token: undefined })],
            { ...baseContext, purchase: purchase("eur", 600) },
            "campaign-1",
            undefined,
            undefined,
            undefined,
            MERCHANT_DEFAULT
        );

        expect(pricingRepository.convertFiatToTokenAmount).toHaveBeenCalledWith(
            expect.objectContaining({ token: MERCHANT_DEFAULT })
        );
        expect(calculated[0].amount).toBe(20);
    });

    it("errors without deferring when no token can be resolved", async () => {
        const { errors, deferForUnpriceableReward } =
            await calculator.calculateAll(
                [tieredReward({ token: undefined })],
                { ...baseContext, purchase: purchase("eur", 100) },
                "campaign-1"
            );

        expect(deferForUnpriceableReward).toBe(false);
        expect(errors[0]).toContain("No token");
        expect(
            pricingRepository.convertFiatToTokenAmount
        ).not.toHaveBeenCalled();
    });

    it("pays a percent of the token-converted value for percent tiers", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: true, tokenAmount: 310 }
        );

        const { calculated } = await calculator.calculateAll(
            [
                tieredReward({
                    tiers: [
                        { minValue: 0, maxValue: 99, amount: 1 },
                        { minValue: 100, percent: 5 },
                    ],
                }),
            ],
            { ...baseContext, purchase: purchase("jpy", 50_000) },
            "campaign-1"
        );

        expect(calculated).toHaveLength(1);
        expect(calculated[0].amount).toBe(15.5);
    });

    it("pays a percent of the raw value for non-purchase tier fields", async () => {
        const { calculated } = await calculator.calculateAll(
            [
                tieredReward({
                    tierField: "user.totalPurchases",
                    tiers: [{ minValue: 0, percent: 10 }],
                }),
            ],
            {
                ...baseContext,
                user: { ...baseContext.user, totalPurchases: 50 },
            },
            "campaign-1"
        );

        expect(
            pricingRepository.convertFiatToTokenAmount
        ).not.toHaveBeenCalled();
        expect(calculated[0].amount).toBe(5);
    });

    it("rejects a matched tier resolving to zero", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: true, tokenAmount: 0 }
        );

        const { calculated, errors } = await calculator.calculateAll(
            [
                tieredReward({
                    tiers: [{ minValue: 0, percent: 5 }],
                }),
            ],
            { ...baseContext, purchase: purchase("eur", 0) },
            "campaign-1"
        );

        expect(calculated).toHaveLength(0);
        expect(errors[0]).toContain("zero or negative");
    });

    it("leaves non-purchase tier fields untouched", async () => {
        const { calculated } = await calculator.calculateAll(
            [
                tieredReward({
                    tierField: "user.totalPurchases",
                    tiers: [
                        { minValue: 0, maxValue: 4, amount: 1 },
                        { minValue: 5, amount: 10 },
                    ],
                }),
            ],
            {
                ...baseContext,
                user: { ...baseContext.user, totalPurchases: 7 },
                purchase: purchase("jpy", 50_000),
            },
            "campaign-1"
        );

        expect(
            pricingRepository.convertFiatToTokenAmount
        ).not.toHaveBeenCalled();
        expect(calculated[0].amount).toBe(10);
    });
});

describe("RewardCalculator.calculateAll — matched_items_amount basis", () => {
    const TOKEN = "0x0000000000000000000000000000000000000abc" as Address;

    const purchaseWithMatch = (
        amount: number,
        matchedAmount: number | undefined
    ): PurchaseContext => ({
        orderId: "order-1",
        amount,
        currency: "usd",
        items: [],
        matchedAmount,
    });

    const percentageReward = (
        overrides: Partial<PercentageRewardDefinition> = {}
    ): RewardDefinition => ({
        recipient: "referee",
        type: "token",
        amountType: "percentage",
        percent: 10,
        percentOf: "matched_items_amount",
        token: TOKEN,
        ...overrides,
    });

    beforeEach(() => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockReset();
    });

    it("pays on the matched subtotal, not the order total", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: true, tokenAmount: 5 }
        );

        const { calculated } = await calculator.calculateAll(
            [percentageReward()],
            {
                ...baseContext,
                purchase: purchaseWithMatch(1000, 50),
            },
            "campaign-1"
        );

        expect(pricingRepository.convertFiatToTokenAmount).toHaveBeenCalledWith(
            expect.objectContaining({ fiatAmount: 5 })
        );
        expect(calculated[0].amount).toBe(5);
    });

    it("clamps a matched subtotal that exceeds the order total actually paid", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: true, tokenAmount: 7 }
        );

        await calculator.calculateAll(
            [percentageReward()],
            {
                ...baseContext,
                purchase: purchaseWithMatch(70, 100),
            },
            "campaign-1"
        );

        expect(pricingRepository.convertFiatToTokenAmount).toHaveBeenCalledWith(
            expect.objectContaining({ fiatAmount: 7 })
        );
    });

    it("still applies min/max caps post-conversion", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: true, tokenAmount: 50 }
        );

        const { calculated } = await calculator.calculateAll(
            [percentageReward({ maxAmount: 8 })],
            {
                ...baseContext,
                purchase: purchaseWithMatch(1000, 50),
            },
            "campaign-1"
        );

        expect(calculated[0].amount).toBe(8);
    });

    it("errors (never defers) when matchedAmount is zero", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: true, tokenAmount: 0 }
        );

        const { calculated, errors, deferForUnpriceableReward } =
            await calculator.calculateAll(
                [percentageReward()],
                {
                    ...baseContext,
                    purchase: purchaseWithMatch(1000, 0),
                },
                "campaign-1"
            );

        expect(deferForUnpriceableReward).toBe(false);
        expect(calculated).toHaveLength(0);
        expect(errors[0]).toContain("zero or negative");
    });

    it("errors (never defers) when matchedAmount is zero, even if the currency/token is unpriceable", async () => {
        // Regression: a zero fiat base must short-circuit before the pricing
        // call, otherwise an unpriceable currency defers forever.
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: false, reason: "fx_rate_unavailable" }
        );

        const { calculated, errors, deferForUnpriceableReward } =
            await calculator.calculateAll(
                [percentageReward()],
                {
                    ...baseContext,
                    purchase: purchaseWithMatch(1000, 0),
                },
                "campaign-1"
            );

        expect(deferForUnpriceableReward).toBe(false);
        expect(calculated).toHaveLength(0);
        expect(errors[0]).toContain("zero or negative");
        expect(
            pricingRepository.convertFiatToTokenAmount
        ).not.toHaveBeenCalled();
    });

    it("errors (never defers) when matchedAmount is missing", async () => {
        const { calculated, errors, deferForUnpriceableReward } =
            await calculator.calculateAll(
                [percentageReward()],
                {
                    ...baseContext,
                    purchase: purchaseWithMatch(1000, undefined),
                },
                "campaign-1"
            );

        expect(deferForUnpriceableReward).toBe(false);
        expect(calculated).toHaveLength(0);
        expect(errors[0]).toContain("matchedAmount");
        expect(
            pricingRepository.convertFiatToTokenAmount
        ).not.toHaveBeenCalled();
    });

    it("still defers on a genuine FX/token-price gap, not on the zero/missing path", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: false, reason: "fx_rate_unavailable" }
        );

        const { deferForUnpriceableReward } = await calculator.calculateAll(
            [percentageReward()],
            {
                ...baseContext,
                purchase: purchaseWithMatch(1000, 50),
            },
            "campaign-1"
        );

        expect(deferForUnpriceableReward).toBe(true);
    });
});

describe("RewardCalculator.calculateAll — tiered purchase.matchedAmount normalisation", () => {
    const TOKEN = "0x0000000000000000000000000000000000000abc" as Address;

    const purchaseWithMatch = (
        amount: number,
        matchedAmount: number | undefined
    ): PurchaseContext => ({
        orderId: "order-1",
        amount,
        currency: "usd",
        items: [],
        matchedAmount,
    });

    const tieredReward = (
        overrides: Partial<TieredRewardDefinition> = {}
    ): RewardDefinition => ({
        recipient: "referee",
        type: "token",
        amountType: "tiered",
        tierField: "purchase.matchedAmount",
        tiers: [
            { minValue: 0, maxValue: 99, amount: 1 },
            { minValue: 100, amount: 5 },
        ],
        token: TOKEN,
        ...overrides,
    });

    beforeEach(() => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockReset();
    });

    it("resolves tiers against the matched basis, converted like purchase.amount", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: true, tokenAmount: 120 }
        );

        const { calculated } = await calculator.calculateAll(
            [tieredReward()],
            {
                ...baseContext,
                purchase: purchaseWithMatch(1000, 150),
            },
            "campaign-1"
        );

        expect(pricingRepository.convertFiatToTokenAmount).toHaveBeenCalledWith(
            expect.objectContaining({ fiatAmount: 150 })
        );
        expect(calculated[0].amount).toBe(5);
    });

    it("clamps a matched tier basis that exceeds the order total actually paid", async () => {
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: true, tokenAmount: 70 }
        );

        await calculator.calculateAll(
            [tieredReward()],
            {
                ...baseContext,
                purchase: purchaseWithMatch(70, 150),
            },
            "campaign-1"
        );

        expect(pricingRepository.convertFiatToTokenAmount).toHaveBeenCalledWith(
            expect.objectContaining({ fiatAmount: 70 })
        );
    });

    it("is a hard error (not a number) when matchedAmount is missing", async () => {
        const { calculated, errors, deferForUnpriceableReward } =
            await calculator.calculateAll(
                [tieredReward()],
                {
                    ...baseContext,
                    purchase: purchaseWithMatch(1000, undefined),
                },
                "campaign-1"
            );

        expect(deferForUnpriceableReward).toBe(false);
        expect(calculated).toHaveLength(0);
        expect(errors[0]).toContain("is not a number");
    });

    it("resolves the zero-matchedAmount tier without deferring, even if the currency/token is unpriceable", async () => {
        // Regression: matchedAmount 0 must skip the pricing call rather than
        // defer forever if convertFiatToTokenAmount would have failed.
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: false, reason: "fx_rate_unavailable" }
        );

        const { calculated, deferForUnpriceableReward } =
            await calculator.calculateAll(
                [tieredReward()],
                {
                    ...baseContext,
                    purchase: purchaseWithMatch(1000, 0),
                },
                "campaign-1"
            );

        expect(deferForUnpriceableReward).toBe(false);
        expect(
            pricingRepository.convertFiatToTokenAmount
        ).not.toHaveBeenCalled();
        // matchedAmount 0 falls into the { minValue: 0, maxValue: 99 } tier.
        expect(calculated[0]?.amount).toBe(1);
    });
});

describe("RewardCalculator — matchedAmount float rounding", () => {
    it("roundAmount reconciles sub-cent float drift from summed line totals", async () => {
        const TOKEN = "0x0000000000000000000000000000000000000abc" as Address;
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockReset();
        vi.mocked(pricingRepository.convertFiatToTokenAmount).mockResolvedValue(
            { converted: true, tokenAmount: 10 }
        );

        // 0.1 summed three times is 0.30000000000000004: the engine must round
        // matchedAmount to 1e-6 before the calculator sees it.
        const drifted = 0.1 + 0.1 + 0.1;
        const rounded = Math.round(drifted * 1_000_000) / 1_000_000;
        expect(rounded).toBe(0.3);

        const { calculated } = await calculator.calculateAll(
            [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "percentage",
                    percent: 10,
                    percentOf: "matched_items_amount",
                    token: TOKEN,
                },
            ],
            {
                ...baseContext,
                purchase: {
                    orderId: "order-1",
                    amount: rounded,
                    currency: "usd",
                    items: [],
                    matchedAmount: rounded,
                },
            },
            "campaign-1"
        );

        expect(pricingRepository.convertFiatToTokenAmount).toHaveBeenCalledWith(
            expect.objectContaining({ fiatAmount: 0.03 })
        );
        expect(calculated[0].amount).toBe(10);
    });
});
