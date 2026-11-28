import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type {
    RewardDefinition,
    SubscriptionRule,
} from "../../campaign/schemas";
import type { DetailedAssetLog } from "../types";
import { RewardHistoryService } from "./RewardHistoryService";

const TOKEN = "0x0000000000000000000000000000000000000001" as Address;

const welcomeBonusLog: DetailedAssetLog = {
    id: "asset-1",
    amount: "5",
    tokenAddress: TOKEN,
    status: "pending",
    recipientType: "welcome_bonus",
    createdAt: new Date("2026-09-25T10:00:00Z"),
    settledAt: null,
    availableAt: null,
    held: false,
    planStep: null,
    campaignRuleId: "campaign-1",
    interactionLogId: "interaction-1",
    cancellationReason: null,
    onchainTxHash: null,
    interactionType: "purchase",
    interactionPayload: {
        orderId: "order-1",
        externalCustomerId: "customer-1",
        amount: 80,
        currency: "EUR",
        items: [],
        purchaseId: "purchase-1",
    },
    referralLinkId: "frak-link",
    identityGroupId: "user-group",
    merchantId: "merchant-1",
    merchantName: "Brand A",
    merchantDomain: "brand-a.com",
    merchantExplorerConfig: null,
};

const emptyEnrichment = {
    tokenMetadata: new Map(),
    tokenPrices: new Map(),
    purchaseAmounts: new Map(),
    referrerPurchases: new Map(),
};

describe("RewardHistoryService", () => {
    it.each([
        { status: "pending", held: true, shown: "locked" },
        { status: "expired", held: true, shown: "expired" },
        { status: "pending", held: false, shown: "pending" },
    ] as const)(
        "shows a $status reward (held: $held) as $shown",
        ({ status, held, shown }) => {
            const [item] = new RewardHistoryService().buildRewardItems(
                [{ ...welcomeBonusLog, status, held }],
                emptyEnrichment
            );

            expect(item?.status).toBe(shown);
        }
    );

    it("renders a welcome bonus with its role and the user's own purchase", () => {
        const [item] = new RewardHistoryService().buildRewardItems(
            [welcomeBonusLog],
            emptyEnrichment
        );

        expect(item).toMatchObject({
            role: "welcome_bonus",
            trigger: "purchase",
            purchase: { id: "purchase-1", amount: 80, currency: "EUR" },
        });
    });
});

describe("RewardHistoryService subscription plans", () => {
    const planStep = (
        step: number,
        over: Partial<DetailedAssetLog> = {}
    ): DetailedAssetLog => ({
        ...welcomeBonusLog,
        id: `step-${step}`,
        recipientType: "referee",
        planStep: step,
        amount: "5",
        status: "pending",
        held: true,
        ...over,
    });

    const build = (
        logs: DetailedAssetLog[],
        definitions: RewardDefinition[] = [],
        subscription: SubscriptionRule = {}
    ) =>
        new RewardHistoryService().buildRewardItems(logs, {
            ...emptyEnrichment,
            planRules: new Map([
                ["campaign-1", { rewards: definitions, subscription }],
            ]),
        });

    const percentage = (from: number, to: number): RewardDefinition => ({
        recipient: "referee",
        type: "token",
        amountType: "percentage",
        percent: 10,
        percentOf: "purchase_amount",
        cycles: { from, to },
    });

    it("collapses the steps of a plan into one item worth the plan total", () => {
        const items = build([
            planStep(1, {
                held: false,
                status: "settled",
                settledAt: new Date("2026-10-01"),
            }),
            planStep(2),
            planStep(3),
        ]);

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            id: "step-1",
            amount: { amount: 15 },
            plan: {
                stepsEarned: 1,
                stepsTotal: 3,
                paidAmount: { amount: 5 },
                pendingAmount: { amount: 10 },
            },
        });
    });

    it("tells each step apart: paid, unlocking, upcoming, expired", () => {
        const [item] = build([
            planStep(1, { held: false, status: "settled" }),
            planStep(2, { held: false, availableAt: new Date("2026-12-01") }),
            planStep(3),
            planStep(4, { status: "expired" }),
        ]);

        expect(item?.plan?.steps.map((s) => s.status)).toEqual([
            "paid",
            "unlocking",
            "upcoming",
            "expired",
        ]);
        expect(item?.plan?.steps[1]?.availableAt).toEqual(
            new Date("2026-12-01")
        );
        expect(item?.amount.amount).toBe(15);
    });

    it("marks only the percentage steps not yet paid as estimates", () => {
        const [item] = build(
            [
                planStep(1, { held: false, status: "settled" }),
                planStep(2),
                planStep(3),
            ],
            [percentage(1, 3)]
        );

        expect(item?.plan?.steps.map((s) => s.estimated)).toEqual([
            false,
            true,
            true,
        ]);
        expect(item?.plan?.estimated).toBe(true);
    });

    it("never calls a step of an amount plan an estimate", () => {
        const [item] = build(
            [planStep(1, { held: false, status: "settled" }), planStep(2)],
            [percentage(1, 3)],
            { stepBy: "amount", stepAmount: 30 }
        );

        expect(item?.plan).toMatchObject({
            stepBy: "amount",
            estimated: false,
        });
    });

    it("tells the wallet how long a duration step lasts", () => {
        const [item] = build([planStep(1), planStep(2)], [], {
            stepBy: "duration",
            stepDays: 30,
        });

        expect(item?.plan).toMatchObject({
            stepBy: "duration",
            stepDays: 30,
        });
    });

    it("reads a plan without a mode as counting cycles", () => {
        const [item] = build([planStep(1), planStep(2)]);

        expect(item?.plan?.stepBy).toBe("cycle");
        expect(item?.plan?.stepDays).toBeUndefined();
    });

    it("never calls a fixed step an estimate", () => {
        const [item] = build(
            [planStep(1), planStep(2)],
            [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "fixed",
                    amount: 5,
                    cycles: { from: 1, to: 2 },
                },
            ]
        );

        expect(item?.plan?.estimated).toBe(false);
    });

    it("reads as locked while the next step is still to come", () => {
        const [item] = build([
            planStep(1, { held: false, status: "settled" }),
            planStep(2),
        ]);

        expect(item?.status).toBe("locked");
    });

    it("reads as settled once every step is paid", () => {
        const [item] = build([
            planStep(1, { held: false, status: "settled" }),
            planStep(2, { held: false, status: "settled" }),
        ]);

        expect(item?.status).toBe("settled");
    });

    it("reads as expired when no step is left to pay, keeping what was paid", () => {
        const [item] = build([
            planStep(1, { held: false, status: "settled" }),
            planStep(2, { status: "expired" }),
            planStep(3, { status: "expired" }),
        ]);

        expect(item?.status).toBe("settled");
        expect(item?.amount.amount).toBe(5);
    });

    it("lets the live row of a re-armed step speak instead of the expired one", () => {
        const [item] = build([
            planStep(1, { held: false, status: "settled" }),
            planStep(2, { id: "old", status: "expired" }),
            planStep(2, { id: "new" }),
        ]);

        expect(item?.plan?.steps.map((s) => s.status)).toEqual([
            "paid",
            "upcoming",
        ]);
    });

    it("keeps the plans of two campaigns, or two sides, apart", () => {
        const items = build([
            planStep(1),
            planStep(2),
            planStep(1, {
                id: "other",
                recipientType: "referrer",
                interactionLogId: "interaction-2",
            }),
        ]);

        expect(items.map((i) => i.id)).toEqual(["step-1", "other"]);
    });

    it("leaves ordinary rewards untouched", () => {
        const [item] = build([welcomeBonusLog]);

        expect(item?.plan).toBeUndefined();
    });
});
