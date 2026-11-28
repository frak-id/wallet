import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalculatedReward } from "../domain/campaign";
import { FRAK_REFERRAL_IDENTITY_GROUP_ID } from "../domain/referral-code/constants";
import type { AssetLogInsert } from "../domain/rewards/db/schema";
import type { CreateAssetLogParams } from "../domain/rewards/types";
import { BatchRewardOrchestrator } from "./BatchRewardOrchestrator";

const { txInsert, txUpdate } = vi.hoisted(() => ({
    txInsert: vi.fn(),
    txUpdate: vi.fn(),
}));

vi.mock("../infrastructure/persistence/postgres", () => {
    const lockedRow = { id: "interaction-1", cancelledAt: null };
    const tx = {
        select: () => ({
            from: () => ({
                where: () => ({
                    for: () => ({ limit: async () => [lockedRow] }),
                }),
            }),
        }),
        insert: () => ({
            values: (rows: AssetLogInsert[]) => ({
                returning: async () => txInsert(rows),
            }),
        }),
        update: () => ({ set: () => ({ where: async () => txUpdate() }) }),
    };
    return {
        db: {
            transaction: async (fn: (t: typeof tx) => Promise<unknown>) =>
                fn(tx),
            update: tx.update,
        },
        withAdvisoryLock: async (_name: string, task: () => Promise<unknown>) =>
            task(),
    };
});

const USER = "user-group";
const MERCHANT = "merchant-1";
const CAMPAIGN = "campaign-1";
const TOKEN = "0x0000000000000000000000000000000000000001" as Address;

const reward = (over: Partial<CalculatedReward>): CalculatedReward => ({
    recipient: "referee",
    recipientIdentityGroupId: USER,
    type: "token",
    amount: 5,
    token: TOKEN,
    campaignRuleId: CAMPAIGN,
    ...over,
});

const refereeReward = reward({});
const frakReferrerReward = reward({
    recipient: "referrer",
    recipientIdentityGroupId: FRAK_REFERRAL_IDENTITY_GROUP_ID,
});

const purchase = {
    id: "interaction-1",
    type: "purchase" as const,
    identityGroupId: USER,
    merchantId: MERCHANT,
    externalEventId: "order-1",
    payload: {},
    processedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
};

function makeOrchestrator(opts: {
    rewards: CalculatedReward[];
    referrer: string | null;
    bonusAlreadyClaimed?: boolean;
    payload?: unknown;
    hasPlan?: boolean;
    syncDeferred?: boolean;
}) {
    const assetLogRepository = {
        hasLiveWelcomeBonus: vi
            .fn()
            .mockResolvedValue(opts.bonusAlreadyClaimed ?? false),
        buildInserts: (params: CreateAssetLogParams[]) =>
            params.map((p) => ({
                identityGroupId: p.identityGroupId,
                campaignRuleId: p.campaignRuleId,
                recipientType: p.recipientType,
                amount: p.amount.toString(),
                held: p.held,
                planStep: p.planStep,
            })),
    };
    const planOrchestrator = {
        hasPlan: vi.fn().mockResolvedValue(opts.hasPlan ?? false),
        syncPlan: vi.fn().mockResolvedValue({
            deferred: opts.syncDeferred ?? false,
        }),
    };
    const campaignRuleRepository = { restoreBudget: vi.fn() };
    const ruleEngine = {
        evaluateRules: vi.fn().mockResolvedValue({
            rewards: opts.rewards,
            budgetExceeded: false,
            skippedCampaigns: [],
            scopeMatchedNoItemCampaigns: [],
            errors: [],
            deferForUnpriceableReward: false,
        }),
    };

    const orchestrator = new BatchRewardOrchestrator(
        {
            findUnprocessedForRewards: vi
                .fn()
                .mockResolvedValue([
                    { ...purchase, payload: opts.payload ?? purchase.payload },
                ]),
        } as never,
        assetLogRepository as never,
        ruleEngine as never,
        { getReferralChain: vi.fn() } as never,
        { getWalletForGroup: vi.fn().mockResolvedValue(null) } as never,
        {
            build: vi.fn().mockResolvedValue({
                trigger: "purchase",
                context: {
                    attribution: { referrerIdentityGroupId: opts.referrer },
                    user: { identityGroupId: USER, walletAddress: null },
                },
                referralLinkId: "link-1",
            }),
        } as never,
        { getDefaultRewardToken: vi.fn().mockResolvedValue(TOKEN) } as never,
        campaignRuleRepository as never,
        planOrchestrator as never
    );

    return {
        orchestrator,
        assetLogRepository,
        campaignRuleRepository,
        ruleEngine,
        planOrchestrator,
    };
}

describe("BatchRewardOrchestrator Frak referral policy", () => {
    beforeEach(() => {
        txInsert.mockImplementation(async (rows: AssetLogInsert[]) => rows);
        txUpdate.mockResolvedValue(undefined);
    });

    it("skips the claim lookup when Frak is not a recipient", async () => {
        const { orchestrator, assetLogRepository } = makeOrchestrator({
            rewards: [refereeReward],
            referrer: null,
        });

        await orchestrator.processPendingInteractions({ limit: 10 });

        expect(assetLogRepository.hasLiveWelcomeBonus).not.toHaveBeenCalled();
    });

    it("leaves the interaction unprocessed when a concurrent claim wins", async () => {
        txInsert.mockRejectedValue(
            Object.assign(new Error("duplicate key"), { code: "23505" })
        );
        const { orchestrator, campaignRuleRepository } = makeOrchestrator({
            rewards: [refereeReward, frakReferrerReward],
            referrer: FRAK_REFERRAL_IDENTITY_GROUP_ID,
        });

        const result = await orchestrator.processPendingInteractions({
            limit: 10,
        });

        expect(result.processedCount).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(txUpdate).not.toHaveBeenCalled();
        expect(campaignRuleRepository.restoreBudget).toHaveBeenCalledWith(
            CAMPAIGN,
            10
        );
    });
});

describe("BatchRewardOrchestrator held rewards", () => {
    beforeEach(() => {
        txInsert.mockImplementation(async (rows: AssetLogInsert[]) => rows);
        txUpdate.mockResolvedValue(undefined);
    });

    it.each([true, undefined])(
        "inserts a reward with held %s",
        async (held) => {
            const { orchestrator } = makeOrchestrator({
                rewards: [
                    reward({
                        recipient: "referrer",
                        recipientIdentityGroupId: "referrer-group",
                        held,
                    }),
                ],
                referrer: "referrer-group",
            });

            await orchestrator.processPendingInteractions({ limit: 10 });

            expect(txInsert).toHaveBeenCalledWith([
                expect.objectContaining({ held }),
            ]);
        }
    );
});

describe("BatchRewardOrchestrator subscription interactions", () => {
    beforeEach(() => {
        txInsert.mockImplementation(async (rows: AssetLogInsert[]) => rows);
        txUpdate.mockReset();
        txUpdate.mockResolvedValue(undefined);
    });

    const resolvedPayload = (kind: "checkout" | "renewal", counted = true) => ({
        subscription: {
            state: "resolved",
            kind,
            cyclesCovered: 1,
            merchandiseAmount: 30,
            counted,
            providerSubscriptionIds: ["sub-1"],
        },
    });

    const planReward = (step: number, over: Partial<CalculatedReward> = {}) =>
        reward({ planStep: step, held: true, ...over });

    it("defers an interaction whose subscription is still pending", async () => {
        const { orchestrator, ruleEngine, planOrchestrator } = makeOrchestrator(
            {
                rewards: [refereeReward],
                referrer: null,
                payload: { subscription: { state: "pending" } },
            }
        );

        const result = await orchestrator.processPendingInteractions({
            limit: 10,
        });

        expect(result).toMatchObject({ deferredCount: 1, processedCount: 0 });
        expect(ruleEngine.evaluateRules).not.toHaveBeenCalled();
        expect(planOrchestrator.syncPlan).not.toHaveBeenCalled();
    });

    it("moves the plan forward on a renewal instead of evaluating it", async () => {
        const { orchestrator, ruleEngine, planOrchestrator } = makeOrchestrator(
            {
                rewards: [refereeReward],
                referrer: null,
                payload: resolvedPayload("renewal"),
            }
        );

        const result = await orchestrator.processPendingInteractions({
            limit: 10,
        });

        expect(result).toMatchObject({ processedCount: 1, rewardsCreated: 0 });
        expect(planOrchestrator.syncPlan).toHaveBeenCalledWith(MERCHANT, USER);
        expect(ruleEngine.evaluateRules).not.toHaveBeenCalled();
        expect(txUpdate).toHaveBeenCalledOnce();
    });

    it("leaves a renewal unprocessed while a step cannot be priced", async () => {
        const { orchestrator } = makeOrchestrator({
            rewards: [],
            referrer: null,
            payload: resolvedPayload("renewal"),
            syncDeferred: true,
        });

        const result = await orchestrator.processPendingInteractions({
            limit: 10,
        });

        expect(result).toMatchObject({ deferredCount: 1, processedCount: 0 });
        expect(txUpdate).not.toHaveBeenCalled();
    });

    it("counts the checkout of a resubscriber as a cycle, without evaluating", async () => {
        const { orchestrator, ruleEngine, planOrchestrator } = makeOrchestrator(
            {
                rewards: [refereeReward],
                referrer: null,
                payload: resolvedPayload("checkout"),
                hasPlan: true,
            }
        );

        await orchestrator.processPendingInteractions({ limit: 10 });

        expect(planOrchestrator.hasPlan).toHaveBeenCalledWith(MERCHANT, USER);
        expect(planOrchestrator.syncPlan).toHaveBeenCalledWith(MERCHANT, USER);
        expect(ruleEngine.evaluateRules).not.toHaveBeenCalled();
    });

    it("evaluates the first checkout of a subscriber and opens the plan", async () => {
        const { orchestrator, ruleEngine, planOrchestrator } = makeOrchestrator(
            {
                rewards: [planReward(1), planReward(2)],
                referrer: null,
                payload: resolvedPayload("checkout"),
            }
        );

        const result = await orchestrator.processPendingInteractions({
            limit: 10,
        });

        expect(ruleEngine.evaluateRules).toHaveBeenCalledOnce();
        expect(result.rewardsCreated).toBe(2);
        expect(txInsert).toHaveBeenCalledWith([
            expect.objectContaining({ planStep: 1, held: true }),
            expect.objectContaining({ planStep: 2, held: true }),
        ]);
        expect(planOrchestrator.syncPlan).toHaveBeenCalledWith(MERCHANT, USER, {
            notifyUnlocks: false,
        });
    });

    it("leaves the checkout to the cron when its first release is deferred", async () => {
        const { orchestrator } = makeOrchestrator({
            rewards: [planReward(1)],
            referrer: null,
            payload: resolvedPayload("checkout"),
            syncDeferred: true,
        });

        await orchestrator.processPendingInteractions({ limit: 10 });

        expect(txUpdate).toHaveBeenCalledTimes(2);
    });

    it("leaves the checkout to the cron when its first release fails", async () => {
        const { orchestrator, planOrchestrator } = makeOrchestrator({
            rewards: [planReward(1)],
            referrer: null,
            payload: resolvedPayload("checkout"),
        });
        planOrchestrator.syncPlan.mockRejectedValue(new Error("boom"));

        await orchestrator.processPendingInteractions({ limit: 10 });

        expect(txUpdate).toHaveBeenCalledTimes(2);
    });

    it("keeps the checkout processed when its first step was released", async () => {
        const { orchestrator } = makeOrchestrator({
            rewards: [planReward(1)],
            referrer: null,
            payload: resolvedPayload("checkout"),
        });

        await orchestrator.processPendingInteractions({ limit: 10 });

        expect(txUpdate).toHaveBeenCalledTimes(1);
    });

    it("evaluates a checkout that earned nothing like a plain purchase", async () => {
        const { orchestrator, ruleEngine } = makeOrchestrator({
            rewards: [],
            referrer: null,
            payload: resolvedPayload("checkout", false),
        });

        await orchestrator.processPendingInteractions({ limit: 10 });

        expect(ruleEngine.evaluateRules).toHaveBeenCalledOnce();
    });

    it("drops the Frak share of a plan instead of redirecting it", async () => {
        const { orchestrator, assetLogRepository } = makeOrchestrator({
            rewards: [
                planReward(1),
                planReward(1, {
                    recipient: "referrer",
                    recipientIdentityGroupId: FRAK_REFERRAL_IDENTITY_GROUP_ID,
                }),
            ],
            referrer: FRAK_REFERRAL_IDENTITY_GROUP_ID,
            payload: resolvedPayload("checkout"),
        });

        await orchestrator.processPendingInteractions({ limit: 10 });

        expect(txInsert).toHaveBeenCalledWith([
            expect.objectContaining({ recipientType: "referee", planStep: 1 }),
        ]);
        expect(assetLogRepository.hasLiveWelcomeBonus).not.toHaveBeenCalled();
    });
});
