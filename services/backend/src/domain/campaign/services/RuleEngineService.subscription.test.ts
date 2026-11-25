import { describe, expect, it, vi } from "vitest";
import type { AssetLogRepository } from "../../rewards/repositories/AssetLogRepository";
import type { CampaignRuleSelect } from "../db/schema";
import type { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import type {
    CampaignRuleDefinition,
    PurchaseContext,
    RuleContext,
} from "../types";
import { RewardCalculator } from "./RewardCalculator";
import { RuleConditionEvaluator } from "./RuleConditionEvaluator";
import { RuleEngineService } from "./RuleEngineService";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const TOKEN = "0x0000000000000000000000000000000000000001" as const;

const purchase = (over: Partial<PurchaseContext> = {}): PurchaseContext => ({
    orderId: "order-1",
    amount: 60,
    currency: "EUR",
    items: [],
    isSubscription: true,
    subscription: { kind: "checkout", cyclesCovered: 3, cycleAmount: 20 },
    ...over,
});

const context = (
    over: Partial<PurchaseContext> = {}
): Omit<RuleContext, "time"> => ({
    user: { identityGroupId: "referee-group", walletAddress: null },
    attribution: { referrerIdentityGroupId: "referrer-group" },
    purchase: purchase(over),
});

const campaign = (rule: Partial<CampaignRuleDefinition>): CampaignRuleSelect =>
    ({
        id: "campaign-1",
        merchantId: "merchant-1",
        name: "Plan",
        status: "active",
        priority: 0,
        rule: {
            trigger: "purchase",
            conditions: [],
            rewards: [],
            ...rule,
        },
        budgetConfig: null,
        budgetUsed: {},
    }) as unknown as CampaignRuleSelect;

const subscriptionRule: Partial<CampaignRuleDefinition> = {
    subscription: { inactivityDays: 60 },
    rewards: [
        {
            recipient: "referrer",
            type: "token",
            amountType: "fixed",
            amount: 10,
            cycles: { from: 1, to: 1 },
        },
        {
            recipient: "referrer",
            type: "token",
            amountType: "fixed",
            amount: 5,
            cycles: { from: 2, to: 3 },
        },
        {
            recipient: "referee",
            type: "token",
            amountType: "percentage",
            percent: 10,
            percentOf: "purchase_amount",
            token: TOKEN,
            cycles: { from: 1, to: 3 },
        },
    ],
};

function setup(
    campaigns: CampaignRuleSelect[],
    options: { merchantCap?: number; campaignCount?: number } = {}
) {
    const repository = {
        findActiveByMerchant: vi.fn().mockResolvedValue(campaigns),
        consumeBudget: vi.fn().mockResolvedValue({ success: true }),
    };
    const assetLogs = {
        countByCampaignsAndUserAsReferee: vi
            .fn()
            .mockResolvedValue(
                new Map([["campaign-1", options.campaignCount ?? 0]])
            ),
        countByMerchantAndUserAsReferee: vi
            .fn()
            .mockResolvedValue(options.merchantCap ?? 0),
    };
    const pricing = {
        convertFiatToTokenAmount: vi.fn(async ({ fiatAmount }) => ({
            converted: true,
            tokenAmount: fiatAmount,
        })),
    };
    const evaluator = new RuleConditionEvaluator();
    const service = new RuleEngineService(
        repository as unknown as CampaignRuleRepository,
        evaluator,
        new RewardCalculator(evaluator, pricing as never),
        assetLogs as unknown as AssetLogRepository
    );
    return { service, repository, assetLogs, pricing };
}

const evaluate = (
    service: RuleEngineService,
    over: Partial<PurchaseContext> = {}
) =>
    service.evaluateRules({
        merchantId: "merchant-1",
        trigger: "purchase",
        context: context(over),
        merchantDefaultToken: TOKEN,
    });

describe("RuleEngineService subscription campaigns", () => {
    it("pays nothing on an order that is not a counted subscription checkout", async () => {
        const { service, repository } = setup([campaign(subscriptionRule)]);

        const result = await evaluate(service, { subscription: undefined });

        expect(result.rewards).toEqual([]);
        expect(repository.consumeBudget).not.toHaveBeenCalled();
    });

    it("writes one held row per step and recipient, numbered by step", async () => {
        const { service } = setup([campaign(subscriptionRule)]);

        const { rewards } = await evaluate(service);

        expect(
            rewards.map((r) => [r.recipient, r.planStep, r.amount, r.held])
        ).toEqual([
            ["referrer", 1, 10, true],
            ["referrer", 2, 5, true],
            ["referrer", 3, 5, true],
            ["referee", 1, 2, true],
            ["referee", 2, 2, true],
            ["referee", 3, 2, true],
        ]);
    });

    it("prices a percentage on one billing cycle, not on the whole order", async () => {
        const { service, pricing } = setup([campaign(subscriptionRule)]);

        await evaluate(service);

        expect(pricing.convertFiatToTokenAmount).toHaveBeenCalledWith(
            expect.objectContaining({ fiatAmount: 2 })
        );
    });

    it("reserves the whole plan from the budget at once", async () => {
        const { service, repository } = setup([campaign(subscriptionRule)]);

        await evaluate(service);

        expect(repository.consumeBudget).toHaveBeenCalledExactlyOnceWith(
            "campaign-1",
            10 + 5 + 5 + 2 * 3
        );
    });

    it("lets the steps expire after the inactivity window", async () => {
        const { service } = setup([campaign(subscriptionRule)]);

        const { rewards } = await evaluate(service);

        expect(rewards.every((r) => r.expirationDays === 60)).toBe(true);
        expect(rewards.every((r) => r.lockupSeconds === undefined)).toBe(true);
    });

    it("defers the checkout while a step cannot be priced", async () => {
        const { service, pricing, repository } = setup([
            campaign(subscriptionRule),
        ]);
        pricing.convertFiatToTokenAmount.mockResolvedValue({
            converted: false,
            reason: "fx_rate_unavailable",
        } as never);

        const result = await evaluate(service);

        expect(result.deferForUnpriceableReward).toBe(true);
        expect(repository.consumeBudget).not.toHaveBeenCalled();
    });

    it("counts a plan once against the per-user cap", async () => {
        const capped = campaign({
            ...subscriptionRule,
            merchantMaxRewardsPerUser: 2,
        });
        const { service } = setup(
            ["campaign-1", "campaign-2", "campaign-3"].map((id) => ({
                ...capped,
                id,
            }))
        );

        const { rewards } = await evaluate(service);

        expect(new Set(rewards.map((r) => r.campaignRuleId))).toEqual(
            new Set(["campaign-1", "campaign-2"])
        );
    });
});

describe("RuleEngineService regular campaigns next to subscriptions", () => {
    it("still evaluates a regular campaign on a subscription checkout", async () => {
        const regular = campaign({
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "fixed",
                    amount: 7,
                },
            ],
        });
        const { service } = setup([regular]);

        const { rewards } = await evaluate(service);

        expect(rewards).toHaveLength(1);
        expect(rewards[0]?.planStep).toBeUndefined();
    });

    it("lets a regular campaign exclude subscription orders", async () => {
        const regular = campaign({
            conditions: [
                {
                    field: "purchase.isSubscription",
                    operator: "neq",
                    value: true,
                },
            ],
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "fixed",
                    amount: 7,
                },
            ],
        });
        const { service } = setup([regular]);

        const onSubscription = await evaluate(service);
        const onPlainOrder = await evaluate(service, {
            isSubscription: false,
            subscription: undefined,
        });

        expect(onSubscription.rewards).toEqual([]);
        expect(onPlainOrder.rewards).toHaveLength(1);
    });
});
