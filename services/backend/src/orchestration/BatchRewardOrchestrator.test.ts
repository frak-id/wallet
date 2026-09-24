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
        },
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
            })),
    };
    const campaignRuleRepository = { restoreBudget: vi.fn() };

    const orchestrator = new BatchRewardOrchestrator(
        {
            findUnprocessedForRewards: vi.fn().mockResolvedValue([purchase]),
        } as never,
        assetLogRepository as never,
        {
            evaluateRules: vi.fn().mockResolvedValue({
                rewards: opts.rewards,
                budgetExceeded: false,
                skippedCampaigns: [],
                scopeMatchedNoItemCampaigns: [],
                errors: [],
                deferForUnpriceableReward: false,
            }),
        } as never,
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
        campaignRuleRepository as never
    );

    return { orchestrator, assetLogRepository, campaignRuleRepository };
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
