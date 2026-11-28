import { describe, expect, it, vi } from "vitest";
import type { CampaignRuleRepository } from "../domain/campaign/repositories/CampaignRuleRepository";
import type { InteractionLogSelect } from "../domain/rewards";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import { RewardLifecycleOrchestrator } from "./RewardLifecycleOrchestrator";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@backend-infrastructure", () => ({
    productEvents: { track },
    log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

const buildOrchestrator = () => {
    const assetLog = {
        cancelPendingByInteractionLogs: vi.fn(),
        expirePendingPastDeadline: vi.fn(),
    } as unknown as AssetLogRepository;

    const interactionLog = {
        cancelPurchaseInteractionByExternalId: vi.fn(),
    } as unknown as InteractionLogRepository;

    const campaignRule = {
        restoreBudgetsBatch: vi.fn(),
    } as unknown as CampaignRuleRepository;

    const subscriptionPlan = { syncPlan: vi.fn().mockResolvedValue({}) };

    const orchestrator = new RewardLifecycleOrchestrator(
        assetLog,
        interactionLog,
        campaignRule,
        subscriptionPlan as never
    );

    return {
        orchestrator,
        assetLog,
        interactionLog,
        campaignRule,
        subscriptionPlan,
    };
};

const purchaseInteraction = {
    id: "interaction-1",
    merchantId: "m1",
    identityGroupId: "group-1",
    payload: {},
} as InteractionLogSelect;

describe("RewardLifecycleOrchestrator", () => {
    describe("cancelForRefund", () => {
        // The repository returns null both when no interaction exists and when
        // one exists but failed the `cancelled_at IS NULL` precondition.
        it("returns empty result when no active purchase interaction exists", async () => {
            const { orchestrator, assetLog, interactionLog, campaignRule } =
                buildOrchestrator();
            vi.mocked(
                interactionLog.cancelPurchaseInteractionByExternalId
            ).mockResolvedValue(null);

            const result = await orchestrator.cancelForRefund({
                merchantId: "m1",
                externalId: "order-42",
            });

            expect(result).toEqual({
                affectedCount: 0,
                budgetRestoredByCampaign: {},
            });
            expect(
                interactionLog.cancelPurchaseInteractionByExternalId
            ).toHaveBeenCalledWith({
                merchantId: "m1",
                externalId: "order-42",
            });
            expect(
                assetLog.cancelPendingByInteractionLogs
            ).not.toHaveBeenCalled();
            expect(campaignRule.restoreBudgetsBatch).not.toHaveBeenCalled();
        });

        it("returns empty result when no pending rewards remained at cancel time", async () => {
            const { orchestrator, assetLog, interactionLog, campaignRule } =
                buildOrchestrator();
            vi.mocked(
                interactionLog.cancelPurchaseInteractionByExternalId
            ).mockResolvedValue(purchaseInteraction);
            vi.mocked(
                assetLog.cancelPendingByInteractionLogs
            ).mockResolvedValue([]);

            const result = await orchestrator.cancelForRefund({
                merchantId: "m1",
                externalId: "order-42",
            });

            expect(result.affectedCount).toBe(0);
            expect(
                assetLog.cancelPendingByInteractionLogs
            ).toHaveBeenCalledWith(["interaction-1"], "refund");
            expect(campaignRule.restoreBudgetsBatch).not.toHaveBeenCalled();
        });

        it("cancels pending rewards with reason 'refund' and restores budget", async () => {
            const { orchestrator, assetLog, interactionLog, campaignRule } =
                buildOrchestrator();
            vi.mocked(
                interactionLog.cancelPurchaseInteractionByExternalId
            ).mockResolvedValue(purchaseInteraction);
            vi.mocked(
                assetLog.cancelPendingByInteractionLogs
            ).mockResolvedValue([
                { id: "asset-1", campaignRuleId: "campaign-1", amount: "100" },
                { id: "asset-2", campaignRuleId: "campaign-1", amount: "25" },
                { id: "asset-3", campaignRuleId: "campaign-2", amount: "10" },
            ]);
            vi.mocked(campaignRule.restoreBudgetsBatch).mockResolvedValue({
                "campaign-1": 125,
                "campaign-2": 10,
            });

            const result = await orchestrator.cancelForRefund({
                merchantId: "m1",
                externalId: "order-42",
            });

            expect(
                assetLog.cancelPendingByInteractionLogs
            ).toHaveBeenCalledWith(["interaction-1"], "refund");
            expect(campaignRule.restoreBudgetsBatch).toHaveBeenCalled();
            expect(result.affectedCount).toBe(3);
            expect(result.budgetRestoredByCampaign).toEqual({
                "campaign-1": 125,
                "campaign-2": 10,
            });
        });
    });

    describe("expireOverdueRewards", () => {
        it("returns empty result when no rewards have expired", async () => {
            const { orchestrator, assetLog, campaignRule } =
                buildOrchestrator();
            vi.mocked(assetLog.expirePendingPastDeadline).mockResolvedValue([]);

            const result = await orchestrator.expireOverdueRewards();

            expect(result.affectedCount).toBe(0);
            expect(campaignRule.restoreBudgetsBatch).not.toHaveBeenCalled();
        });

        it("flips expired rewards with reason 'expired' and restores budget", async () => {
            const { orchestrator, assetLog, campaignRule } =
                buildOrchestrator();
            vi.mocked(assetLog.expirePendingPastDeadline).mockResolvedValue([
                { id: "asset-9", campaignRuleId: "campaign-3", amount: "5" },
                { id: "asset-10", campaignRuleId: "campaign-3", amount: "8" },
            ]);
            vi.mocked(campaignRule.restoreBudgetsBatch).mockResolvedValue({
                "campaign-3": 13,
            });

            const result = await orchestrator.expireOverdueRewards();

            expect(assetLog.expirePendingPastDeadline).toHaveBeenCalled();
            expect(result.affectedCount).toBe(2);
            expect(result.budgetRestoredByCampaign).toEqual({
                "campaign-3": 13,
            });
        });
    });
});

describe("RewardLifecycleOrchestrator subscription cycles", () => {
    const refundedCycle = {
        ...purchaseInteraction,
        payload: {
            subscription: {
                state: "resolved",
                kind: "renewal",
                cyclesCovered: 1,
                merchandiseAmount: 20,
                counted: true,
                providerSubscriptionIds: ["sub-1"],
            },
        },
    } as InteractionLogSelect;

    it("resyncs the plan when a refunded order was a billing cycle", async () => {
        const { orchestrator, assetLog, interactionLog, subscriptionPlan } =
            buildOrchestrator();
        vi.mocked(
            interactionLog.cancelPurchaseInteractionByExternalId
        ).mockResolvedValue(refundedCycle);
        vi.mocked(assetLog.cancelPendingByInteractionLogs).mockResolvedValue(
            []
        );

        await orchestrator.cancelForRefund({
            merchantId: "m1",
            externalId: "order-42",
        });

        expect(subscriptionPlan.syncPlan).toHaveBeenCalledWith(
            "m1",
            "group-1",
            {
                rehold: true,
            }
        );
    });

    it("leaves a plain purchase refund alone", async () => {
        const { orchestrator, assetLog, interactionLog, subscriptionPlan } =
            buildOrchestrator();
        vi.mocked(
            interactionLog.cancelPurchaseInteractionByExternalId
        ).mockResolvedValue(purchaseInteraction);
        vi.mocked(assetLog.cancelPendingByInteractionLogs).mockResolvedValue(
            []
        );

        await orchestrator.cancelForRefund({
            merchantId: "m1",
            externalId: "order-42",
        });

        expect(subscriptionPlan.syncPlan).not.toHaveBeenCalled();
    });

    it("still cancels the refund when the plan cannot be resynced", async () => {
        const { orchestrator, assetLog, interactionLog, subscriptionPlan } =
            buildOrchestrator();
        vi.mocked(
            interactionLog.cancelPurchaseInteractionByExternalId
        ).mockResolvedValue(refundedCycle);
        vi.mocked(assetLog.cancelPendingByInteractionLogs).mockResolvedValue(
            []
        );
        subscriptionPlan.syncPlan.mockRejectedValue(new Error("boom"));

        await expect(
            orchestrator.cancelForRefund({
                merchantId: "m1",
                externalId: "order-42",
            })
        ).resolves.toMatchObject({ affectedCount: 0 });
    });

    it("tracks one expiry per plan, not one per step", async () => {
        const { orchestrator, assetLog } = buildOrchestrator();
        vi.mocked(assetLog.expirePendingPastDeadline).mockResolvedValue([
            {
                id: "a",
                campaignRuleId: "c1",
                amount: "5",
                identityGroupId: "g1",
                planStep: 2,
            },
            {
                id: "b",
                campaignRuleId: "c1",
                amount: "5",
                identityGroupId: "g1",
                planStep: 3,
            },
            {
                id: "c",
                campaignRuleId: "c1",
                amount: "5",
                identityGroupId: "g2",
                planStep: null,
            },
        ]);

        await orchestrator.expireOverdueRewards();

        expect(track).toHaveBeenCalledTimes(1);
        expect(track).toHaveBeenCalledWith("subscription_plan_expired", "g1", {
            campaign_id: "c1",
            steps: 2,
        });
    });
});
