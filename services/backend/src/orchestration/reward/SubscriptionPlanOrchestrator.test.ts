import { eventEmitter, productEvents } from "@backend-infrastructure";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignRuleSelect } from "../../domain/campaign/db/schema";
import type {
    RewardDefinition,
    SubscriptionRule,
} from "../../domain/campaign/types";
import type { AssetLogSelect } from "../../domain/rewards/db/schema";
import type { SubscriptionCycle } from "../../domain/rewards/repositories/InteractionLogRepository";
import { db } from "../../infrastructure/persistence/postgres";
import { SubscriptionPlanOrchestrator } from "./SubscriptionPlanOrchestrator";

vi.mock("../../infrastructure/persistence/postgres", () => ({
    db: {
        transaction: vi.fn(async (fn: (tx: object) => Promise<unknown>) =>
            fn({})
        ),
    },
}));

const MERCHANT = "merchant-1";
const REFEREE = "referee-group";
const CAMPAIGN = "campaign-1";
const ANCHOR = "checkout-1";
const TOKEN = "0x0000000000000000000000000000000000000001";
const DAY = 86_400_000;
const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * DAY);

const cycle = (
    id: string,
    at: number,
    over: Partial<SubscriptionCycle> = {}
): SubscriptionCycle => ({
    interactionLogId: id,
    kind: id === ANCHOR ? "checkout" : "renewal",
    paidAt: day(at),
    cyclesCovered: 1,
    merchandiseAmount: 30,
    currency: "EUR",
    ...over,
});

const row = (step: number, over: Partial<AssetLogSelect> = {}) =>
    ({
        id: `row-${over.recipientType ?? "referee"}-${step}${over.status === "expired" ? "-x" : ""}`,
        identityGroupId: REFEREE,
        merchantId: MERCHANT,
        campaignRuleId: CAMPAIGN,
        interactionLogId: ANCHOR,
        assetType: "token",
        amount: "5",
        tokenAddress: TOKEN,
        recipientType: "referee",
        recipientWallet: null,
        referralLinkId: null,
        planStep: step,
        status: "pending",
        heldAt: day(0),
        releasedAt: null,
        cancelledAt: null,
        expiresAt: day(90),
        availableAt: null,
        ...over,
    }) as AssetLogSelect;

const fixedPlan: RewardDefinition[] = [
    {
        recipient: "referee",
        type: "token",
        amountType: "fixed",
        amount: 5,
        cycles: { from: 1, to: 4 },
    },
];

const percentagePlan: RewardDefinition[] = [
    {
        recipient: "referee",
        type: "token",
        amountType: "percentage",
        percent: 10,
        percentOf: "purchase_amount",
        cycles: { from: 1, to: 4 },
    },
];

type Setup = {
    rows: AssetLogSelect[];
    cycles: SubscriptionCycle[];
    rewards?: RewardDefinition[];
    lockupSeconds?: number;
    budget?: boolean;
    price?: { converted: true; amount: number } | "defer" | "error";
    subscription?: SubscriptionRule;
    /** Token units per unit of order currency; `"unavailable"` has no rate. */
    fx?: number | "unavailable";
    noMerchantToken?: boolean;
};

function setup(options: Setup) {
    const campaign = {
        id: CAMPAIGN,
        rule: {
            trigger: "purchase",
            conditions: [],
            rewards: options.rewards ?? fixedPlan,
            subscription: options.subscription ?? { inactivityDays: 60 },
            defaultLockupSeconds: options.lockupSeconds,
        },
    } as unknown as CampaignRuleSelect;

    const assetLogs = {
        findPlanRows: vi.fn().mockResolvedValue(options.rows),
        extendHeldExpiry: vi.fn().mockResolvedValue(undefined),
        releaseHeld: vi.fn(async (items: { id: string }[]) =>
            items.map((item) => item.id)
        ),
        reholdReleased: vi.fn(async (ids: string[]) => ids.length),
        insertPlanRows: vi.fn(async (_tx: unknown, rows: object[]) =>
            rows.map((r, i) => ({
                ...r,
                id: `new-${i}`,
                releasedAt: null,
                cancelledAt: null,
            }))
        ),
        updatePlanRowAmount: vi.fn().mockResolvedValue(undefined),
        hasPlan: vi.fn().mockResolvedValue(true),
    };
    const interactions = {
        findCountedCycles: vi.fn().mockResolvedValue(options.cycles),
    };
    const campaigns = {
        findById: vi.fn().mockResolvedValue(campaign),
        consumeBudget: vi.fn().mockResolvedValue({
            success: options.budget !== false,
        }),
        restoreBudget: vi.fn().mockResolvedValue(undefined),
    };
    const calculator = {
        calculate: vi.fn(async () => {
            const price = options.price;
            if (price === "defer") {
                return {
                    success: false,
                    defer: true,
                    reason: "fx_rate_unavailable",
                };
            }
            if (price === "error") return { success: false, error: "nope" };
            return {
                success: true,
                amount: price?.amount ?? 5,
                token: TOKEN,
            };
        }),
    };
    const pricing = {
        getTokenPrice: vi.fn().mockResolvedValue({ eur: 1 }),
        convertFiatToTokenAmount: vi.fn(
            async ({ fiatAmount }: { fiatAmount: number }) =>
                options.fx === "unavailable"
                    ? { converted: false, reason: "fx_rate_unavailable" }
                    : {
                          converted: true,
                          tokenAmount: fiatAmount * (options.fx ?? 1),
                      }
        ),
    };
    const orchestrator = new SubscriptionPlanOrchestrator(
        assetLogs as never,
        interactions as never,
        campaigns as never,
        {
            getDefaultRewardToken: vi
                .fn()
                .mockResolvedValue(options.noMerchantToken ? null : TOKEN),
        } as never,
        calculator as never,
        {
            getWalletForGroup: vi.fn().mockResolvedValue("0xWallet"),
        } as never,
        pricing as never
    );
    return { orchestrator, assetLogs, campaigns, calculator, pricing };
}

const sync = (
    s: ReturnType<typeof setup>,
    options?: { notifyUnlocks?: boolean; rehold?: boolean }
) => s.orchestrator.syncPlan(MERCHANT, REFEREE, options);

const releasedIds = (s: ReturnType<typeof setup>) =>
    (
        s.assetLogs.releaseHeld.mock.calls[0]?.[0] as
            | { id: string }[]
            | undefined
    )?.map((item) => item.id) ?? [];

beforeEach(() => {
    vi.mocked(eventEmitter.emit).mockClear();
});

describe("syncPlan: steps earned", () => {
    it("releases the first step of a fresh plan and keeps the rest held", async () => {
        const s = setup({
            rows: [row(1), row(2), row(3), row(4)],
            cycles: [cycle(ANCHOR, 0)],
        });

        const result = await sync(s);

        expect(releasedIds(s)).toEqual(["row-referee-1"]);
        expect(result).toEqual({ deferred: false });
    });

    it("releases a step per renewal paid", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2), row(3), row(4)],
            cycles: [cycle(ANCHOR, 0), cycle("r1", 30)],
        });

        await sync(s);

        expect(releasedIds(s)).toEqual(["row-referee-2"]);
    });

    it("unlocks three steps at once for a prepaid charge, each on a third of it", async () => {
        const s = setup({
            rows: [row(1), row(2), row(3), row(4)],
            cycles: [
                cycle(ANCHOR, 0, { cyclesCovered: 3, merchandiseAmount: 90 }),
            ],
        });

        await sync(s, { notifyUnlocks: false });

        expect(releasedIds(s)).toEqual([
            "row-referee-1",
            "row-referee-2",
            "row-referee-3",
        ]);
    });

    it("does not advance on a cycle that was not counted", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2), row(3)],
            cycles: [cycle(ANCHOR, 0)],
        });

        await sync(s);

        expect(s.assetLogs.releaseHeld).toHaveBeenCalledWith(
            [],
            expect.anything(),
            {}
        );
    });

    it("is idempotent: a second sync finds nothing left to do", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2), row(3)],
            cycles: [cycle(ANCHOR, 0)],
        });

        const first = await sync(s);
        const second = await sync(s);

        expect(first).toEqual(second);
        expect(s.assetLogs.releaseHeld).toHaveBeenCalledWith(
            [],
            expect.anything(),
            {}
        );
        expect(s.assetLogs.reholdReleased).not.toHaveBeenCalled();
        expect(s.assetLogs.insertPlanRows).not.toHaveBeenCalled();
    });

    it("does nothing without a plan", async () => {
        const s = setup({ rows: [], cycles: [cycle(ANCHOR, 0)] });

        await expect(sync(s)).resolves.toEqual({ deferred: false });
        expect(s.assetLogs.releaseHeld).not.toHaveBeenCalled();
    });

    it("waits for the campaign lockup after the cycle was paid", async () => {
        const s = setup({
            rows: [row(1)],
            cycles: [cycle(ANCHOR, 10)],
            lockupSeconds: 7 * 86_400,
        });

        await sync(s);

        expect(s.assetLogs.releaseHeld.mock.calls[0]?.[0]).toEqual([
            { id: "row-referee-1", availableAt: day(17) },
        ]);
    });
});

describe("syncPlan: refunds", () => {
    it("takes the step of a refunded cycle back while it is unpaid", async () => {
        const s = setup({
            rows: [
                row(1, { releasedAt: day(0) }),
                row(2, { releasedAt: day(30) }),
            ],
            cycles: [cycle(ANCHOR, 0)],
        });

        await sync(s, { rehold: true });

        expect(s.assetLogs.reholdReleased).toHaveBeenCalledWith(
            ["row-referee-2"],
            {}
        );
    });

    it("leaves a settled step paid", async () => {
        const s = setup({
            rows: [
                row(1, { releasedAt: day(0) }),
                row(2, { releasedAt: day(30), status: "settled" }),
            ],
            cycles: [cycle(ANCHOR, 0)],
        });

        await sync(s, { rehold: true });

        expect(s.assetLogs.reholdReleased).toHaveBeenCalledWith([], {});
    });

    it("earns nothing once the checkout was refunded", async () => {
        const s = setup({
            rows: [row(1, { status: "cancelled" })],
            cycles: [cycle("r1", 30)],
        });

        await sync(s);

        expect(s.assetLogs.releaseHeld).not.toHaveBeenCalled();
        expect(s.assetLogs.extendHeldExpiry).not.toHaveBeenCalled();
    });

    it("never takes a released step back on an ordinary sync", async () => {
        const s = setup({
            rows: [
                row(1, { releasedAt: day(0) }),
                row(2, { releasedAt: day(30) }),
            ],
            cycles: [cycle(ANCHOR, 0)],
        });

        await sync(s);

        expect(s.assetLogs.reholdReleased).not.toHaveBeenCalled();
    });
});

describe("syncPlan: inactivity", () => {
    it("pushes the held steps' expiry to the last paid cycle plus the window", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2), row(3)],
            cycles: [cycle(ANCHOR, 0), cycle("r1", 30)],
        });

        await sync(s);

        expect(s.assetLogs.extendHeldExpiry).toHaveBeenCalledWith(
            {},
            ["row-referee-2", "row-referee-3"],
            day(90)
        );
    });

    it("re-arms the expired steps when the subscriber comes back, budget permitting", async () => {
        const s = setup({
            rows: [
                row(1, { releasedAt: day(0), status: "settled" }),
                row(2, { status: "expired", cancelledAt: day(70) }),
                row(3, { status: "expired", cancelledAt: day(70) }),
            ],
            cycles: [cycle(ANCHOR, 0), cycle("resub", 200)],
        });

        await sync(s);

        expect(s.campaigns.consumeBudget).toHaveBeenCalledWith(CAMPAIGN, 10);
        expect(s.assetLogs.insertPlanRows.mock.calls[0]?.[1]).toEqual([
            expect.objectContaining({ planStep: 2, expiresAt: day(260) }),
            expect.objectContaining({ planStep: 3, expiresAt: day(260) }),
        ]);
    });

    it("resumes from the step reached: a re-armed step already earned is released", async () => {
        const s = setup({
            rows: [
                row(1, { releasedAt: day(0), status: "settled" }),
                row(2, { status: "expired", cancelledAt: day(70) }),
                row(3, { status: "expired", cancelledAt: day(70) }),
            ],
            cycles: [cycle(ANCHOR, 0), cycle("resub", 200)],
        });

        await sync(s);

        expect(releasedIds(s)).toEqual(["new-0"]);
    });

    it("skips the re-arm when the budget is short, and keeps nothing reserved", async () => {
        const s = setup({
            rows: [
                row(1, { releasedAt: day(0), status: "settled" }),
                row(2, { status: "expired", cancelledAt: day(70) }),
            ],
            cycles: [cycle(ANCHOR, 0), cycle("resub", 200)],
            budget: false,
        });

        await sync(s);

        expect(s.assetLogs.insertPlanRows).not.toHaveBeenCalled();
        expect(s.campaigns.restoreBudget).not.toHaveBeenCalled();
    });
});

describe("syncPlan: re-pricing", () => {
    const plan = (over: Partial<Setup> = {}) =>
        setup({
            rows: [
                row(1, { releasedAt: day(0) }),
                row(2, { amount: "3" }),
                row(3, { amount: "3" }),
            ],
            cycles: [cycle(ANCHOR, 0), cycle("r1", 30)],
            rewards: percentagePlan,
            ...over,
        });

    it("reserves the difference when the paid cycle is worth more", async () => {
        const s = plan({ price: { converted: true, amount: 4 } });

        await sync(s);

        expect(s.campaigns.consumeBudget).toHaveBeenCalledWith(CAMPAIGN, 1);
        expect(s.assetLogs.updatePlanRowAmount).toHaveBeenCalledWith(
            {},
            "row-referee-2",
            "4"
        );
    });

    it("reserves every rise of the campaign in one consumption", async () => {
        const s = plan({
            rows: [
                row(1, { releasedAt: day(0) }),
                row(2, { amount: "3" }),
                row(2, { amount: "3", recipientType: "referrer" }),
            ],
            rewards: [
                ...percentagePlan,
                { ...percentagePlan[0], recipient: "referrer" } as never,
            ],
            price: { converted: true, amount: 4 },
        });

        await sync(s);

        expect(s.campaigns.consumeBudget).toHaveBeenCalledOnce();
        expect(s.campaigns.consumeBudget).toHaveBeenCalledWith(CAMPAIGN, 2);
    });

    it("gives the difference back when it is worth less", async () => {
        const s = plan({ price: { converted: true, amount: 2 } });

        await sync(s);

        expect(s.assetLogs.updatePlanRowAmount).toHaveBeenCalledWith(
            {},
            "row-referee-2",
            "2"
        );
        expect(s.campaigns.restoreBudget).toHaveBeenCalledWith(CAMPAIGN, 1);
    });

    it("keeps the reserved amount when the budget is short for the rise", async () => {
        const s = plan({
            price: { converted: true, amount: 4 },
            budget: false,
        });

        await sync(s);

        expect(s.assetLogs.updatePlanRowAmount).not.toHaveBeenCalled();
        expect(releasedIds(s)).toEqual(["row-referee-2"]);
    });

    it("never re-prices a step priced on its own checkout", async () => {
        const s = setup({
            rows: [row(1, { amount: "3" })],
            cycles: [cycle(ANCHOR, 0)],
            rewards: percentagePlan,
            price: { converted: true, amount: 9 },
        });

        await sync(s);

        expect(s.calculator.calculate).not.toHaveBeenCalled();
    });

    it("never re-prices a fixed step", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2)],
            cycles: [cycle(ANCHOR, 0), cycle("r1", 30)],
        });

        await sync(s);

        expect(s.calculator.calculate).not.toHaveBeenCalled();
    });

    it("defers the whole sync, applying nothing, when the cycle cannot be priced", async () => {
        const s = plan({ price: "defer" });

        const result = await sync(s);

        expect(result).toEqual({ deferred: true });
        expect(s.assetLogs.releaseHeld).not.toHaveBeenCalled();
        expect(s.assetLogs.updatePlanRowAmount).not.toHaveBeenCalled();
    });

    it("gives back budget it reserved when the sync is deferred halfway", async () => {
        const s = setup({
            rows: [
                row(1, { releasedAt: day(0) }),
                row(2, { status: "expired", cancelledAt: day(70) }),
                row(3, { amount: "3" }),
            ],
            cycles: [cycle(ANCHOR, 0), cycle("resub", 200)],
            rewards: percentagePlan,
            price: "defer",
        });

        const result = await sync(s);

        expect(result.deferred).toBe(true);
        expect(s.campaigns.restoreBudget).toHaveBeenCalledWith(CAMPAIGN, 5);
    });

    it("keeps the estimate when the cycle cannot be priced for good", async () => {
        const s = plan({ price: "error" });

        await sync(s);

        expect(s.assetLogs.updatePlanRowAmount).not.toHaveBeenCalled();
        expect(releasedIds(s)).toEqual(["row-referee-2"]);
    });
});

describe("syncPlan: notifications", () => {
    const renewal = () =>
        setup({
            rows: [
                row(1, { releasedAt: day(0) }),
                row(2),
                row(2, { recipientType: "referrer", identityGroupId: "ref" }),
            ],
            cycles: [cycle(ANCHOR, 0), cycle("r1", 30)],
        });

    it("tells each recipient once what a renewal unlocked", async () => {
        await sync(renewal());

        expect(eventEmitter.emit).toHaveBeenCalledWith(
            "notification",
            expect.objectContaining({
                type: "reward_step_unlocked",
                notifications: [
                    expect.objectContaining({ role: "referee", eurAmount: 5 }),
                    expect.objectContaining({ role: "referrer", eurAmount: 5 }),
                ],
            })
        );
    });

    it("stays silent at plan creation, which has its own announcement", async () => {
        await sync(renewal(), { notifyUnlocks: false });

        expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("tracks no unlock event at plan creation", async () => {
        vi.mocked(productEvents.track).mockClear();

        await sync(renewal(), { notifyUnlocks: false });

        expect(productEvents.track).not.toHaveBeenCalledWith(
            "subscription_step_unlocked",
            expect.anything(),
            expect.anything()
        );
    });

    it("stays silent when nothing unlocked", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2)],
            cycles: [cycle(ANCHOR, 0)],
        });

        await sync(s);

        expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
});

describe("syncPlan: amount steps", () => {
    const amountPlan: SubscriptionRule = {
        inactivityDays: 60,
        stepBy: "amount",
        stepAmount: 30,
    };

    it("releases a step once its amount is paid across several orders", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2), row(3)],
            cycles: [
                cycle(ANCHOR, 0, { merchandiseAmount: 10 }),
                cycle("r1", 14, { merchandiseAmount: 12 }),
                cycle("r2", 21, { merchandiseAmount: 20 }),
            ],
            subscription: amountPlan,
        });

        await sync(s);

        expect(releasedIds(s)).toEqual(["row-referee-2"]);
    });

    it("converts each order to the reward token before counting it", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2), row(3)],
            cycles: [
                cycle(ANCHOR, 0, { currency: "USD" }),
                cycle("r1", 30, { merchandiseAmount: 25, currency: "USD" }),
            ],
            subscription: amountPlan,
            fx: 0.9,
        });

        await sync(s);

        expect(s.pricing.convertFiatToTokenAmount).toHaveBeenCalledWith({
            token: TOKEN,
            fiatAmount: 25,
            currency: "USD",
        });
        expect(releasedIds(s)).toEqual([]);
    });

    it("needs no exchange rate to earn the first step", async () => {
        const s = setup({
            rows: [row(1), row(2)],
            cycles: [cycle(ANCHOR, 0)],
            subscription: amountPlan,
            fx: "unavailable",
        });

        const result = await sync(s, { notifyUnlocks: false });

        expect(result).toEqual({ deferred: false });
        expect(s.pricing.convertFiatToTokenAmount).not.toHaveBeenCalled();
    });

    it("converts every order before the transaction opens", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2)],
            cycles: [cycle(ANCHOR, 0), cycle("r1", 30)],
            subscription: amountPlan,
        });
        const order: string[] = [];
        s.pricing.convertFiatToTokenAmount.mockImplementation(async () => {
            order.push("fx");
            return { converted: true, tokenAmount: 30 };
        });
        vi.mocked(db.transaction).mockImplementationOnce(async (fn) => {
            order.push("tx");
            return fn({} as never);
        });

        await sync(s);

        expect(order).toEqual(["fx", "tx"]);
    });

    it("defers instead of counting fiat as token units when no token resolves", async () => {
        const s = setup({
            rows: [
                row(1, { releasedAt: day(0), tokenAddress: null }),
                row(2, { tokenAddress: null }),
            ],
            cycles: [cycle(ANCHOR, 0), cycle("r1", 30)],
            subscription: amountPlan,
            noMerchantToken: true,
        });

        await expect(sync(s)).resolves.toMatchObject({ deferred: true });
        expect(s.assetLogs.releaseHeld).not.toHaveBeenCalled();
    });

    it("keeps released steps when a rate rise lowers what was earned", async () => {
        const s = setup({
            rows: [
                row(1, { releasedAt: day(0) }),
                row(2, { releasedAt: day(30) }),
            ],
            cycles: [cycle(ANCHOR, 0), cycle("r1", 30)],
            subscription: amountPlan,
            fx: 0.5,
        });

        await sync(s);

        expect(s.assetLogs.reholdReleased).not.toHaveBeenCalled();
    });

    it("still takes a released step back when a refund lowers what was earned", async () => {
        const s = setup({
            rows: [
                row(1, { releasedAt: day(0) }),
                row(2, { releasedAt: day(30) }),
            ],
            cycles: [cycle(ANCHOR, 0)],
            subscription: amountPlan,
        });

        await sync(s, { rehold: true });

        expect(s.assetLogs.reholdReleased).toHaveBeenCalledWith(
            ["row-referee-2"],
            {}
        );
    });

    it("defers the whole sync when an order has no exchange rate", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2)],
            cycles: [cycle(ANCHOR, 0), cycle("r1", 30)],
            subscription: amountPlan,
            fx: "unavailable",
        });

        await expect(sync(s)).resolves.toMatchObject({ deferred: true });
        expect(s.assetLogs.releaseHeld).not.toHaveBeenCalled();
    });

    it("keeps every step at the amount priced when the plan started", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2), row(3)],
            cycles: [
                cycle(ANCHOR, 0),
                cycle("r1", 30, { merchandiseAmount: 90 }),
            ],
            rewards: percentagePlan,
            subscription: amountPlan,
            price: { converted: true, amount: 9 },
        });

        await sync(s);

        expect(s.calculator.calculate).not.toHaveBeenCalled();
        expect(s.assetLogs.updatePlanRowAmount).not.toHaveBeenCalled();
        expect(releasedIds(s)).toEqual(["row-referee-2", "row-referee-3"]);
    });

    it("keeps a plan alive on an order that earns no step yet", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2)],
            cycles: [
                cycle(ANCHOR, 0),
                cycle("r1", 40, { merchandiseAmount: 5 }),
            ],
            subscription: amountPlan,
        });

        await sync(s);

        expect(s.assetLogs.extendHeldExpiry).toHaveBeenCalledWith(
            {},
            ["row-referee-2"],
            day(100)
        );
        expect(releasedIds(s)).toEqual([]);
    });
});

describe("syncPlan: duration steps", () => {
    const monthly: SubscriptionRule = {
        inactivityDays: 60,
        stepBy: "duration",
        stepDays: 30,
    };

    it("releases the months the subscriber has paid past", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2), row(3), row(4)],
            cycles: [cycle(ANCHOR, 0), cycle("r1", 42), cycle("r2", 63)],
            subscription: monthly,
        });

        await sync(s);

        expect(releasedIds(s)).toEqual(["row-referee-2", "row-referee-3"]);
        expect(s.pricing.convertFiatToTokenAmount).not.toHaveBeenCalled();
    });

    it("releases nothing more for payments within the first month", async () => {
        const s = setup({
            rows: [row(1, { releasedAt: day(0) }), row(2)],
            cycles: [cycle(ANCHOR, 0), cycle("r1", 10), cycle("r2", 20)],
            subscription: monthly,
        });

        await sync(s);

        expect(releasedIds(s)).toEqual([]);
    });
});
