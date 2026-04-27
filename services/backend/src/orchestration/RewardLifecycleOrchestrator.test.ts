import { describe, expect, it, vi } from "vitest";
import type { CampaignRuleRepository } from "../domain/campaign/repositories/CampaignRuleRepository";
import type { AssetLogSelect, InteractionLogSelect } from "../domain/rewards";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import { RewardLifecycleOrchestrator } from "./RewardLifecycleOrchestrator";

vi.mock("@backend-infrastructure", () => ({
    log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

const buildOrchestrator = () => {
    const assetLog = {
        findCancellableByInteractionLogs: vi.fn(),
        findExpiredPendingRewardIds: vi.fn(),
        terminateRewardsBatch: vi.fn(),
    } as unknown as AssetLogRepository;

    const interactionLog = {
        findPurchaseInteractionByExternalId: vi.fn(),
    } as unknown as InteractionLogRepository;

    const campaignRule = {
        restoreBudgetsBatch: vi.fn(),
    } as unknown as CampaignRuleRepository;

    const orchestrator = new RewardLifecycleOrchestrator(
        assetLog,
        interactionLog,
        campaignRule
    );

    return { orchestrator, assetLog, interactionLog, campaignRule };
};

const purchaseInteraction = {
    id: "interaction-1",
} as InteractionLogSelect;

const pendingReward = (overrides?: Partial<AssetLogSelect>): AssetLogSelect =>
    ({
        id: "asset-1",
        campaignRuleId: "campaign-1",
        amount: "100",
        ...overrides,
    }) as AssetLogSelect;

describe("RewardLifecycleOrchestrator", () => {
    describe("cancelForRefund", () => {
        it("returns empty result when no purchase interaction exists", async () => {
            const { orchestrator, assetLog, interactionLog, campaignRule } =
                buildOrchestrator();
            vi.mocked(
                interactionLog.findPurchaseInteractionByExternalId
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
                assetLog.findCancellableByInteractionLogs
            ).not.toHaveBeenCalled();
            expect(assetLog.terminateRewardsBatch).not.toHaveBeenCalled();
            expect(campaignRule.restoreBudgetsBatch).not.toHaveBeenCalled();
        });

        it("returns empty result when no pending rewards remain (idempotent)", async () => {
            const { orchestrator, assetLog, interactionLog, campaignRule } =
                buildOrchestrator();
            vi.mocked(
                interactionLog.findPurchaseInteractionByExternalId
            ).mockResolvedValue(purchaseInteraction);
            vi.mocked(
                assetLog.findCancellableByInteractionLogs
            ).mockResolvedValue([]);

            const result = await orchestrator.cancelForRefund({
                merchantId: "m1",
                externalId: "order-42",
            });

            expect(result.affectedCount).toBe(0);
            expect(assetLog.terminateRewardsBatch).not.toHaveBeenCalled();
            expect(campaignRule.restoreBudgetsBatch).not.toHaveBeenCalled();
        });

        it("cancels pending rewards with reason 'refund' and restores budget", async () => {
            const { orchestrator, assetLog, interactionLog, campaignRule } =
                buildOrchestrator();
            const cancellable = [
                pendingReward({ id: "asset-1", amount: "100" }),
                pendingReward({
                    id: "asset-2",
                    campaignRuleId: "campaign-1",
                    amount: "25",
                }),
                pendingReward({
                    id: "asset-3",
                    campaignRuleId: "campaign-2",
                    amount: "10",
                }),
            ];
            vi.mocked(
                interactionLog.findPurchaseInteractionByExternalId
            ).mockResolvedValue(purchaseInteraction);
            vi.mocked(
                assetLog.findCancellableByInteractionLogs
            ).mockResolvedValue(cancellable);
            vi.mocked(assetLog.terminateRewardsBatch).mockResolvedValue([
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
                assetLog.findCancellableByInteractionLogs
            ).toHaveBeenCalledWith(["interaction-1"]);
            expect(assetLog.terminateRewardsBatch).toHaveBeenCalledWith(
                ["asset-1", "asset-2", "asset-3"],
                "refund"
            );
            expect(campaignRule.restoreBudgetsBatch).toHaveBeenCalled();
            expect(result.affectedCount).toBe(3);
            expect(result.budgetRestoredByCampaign).toEqual({
                "campaign-1": 125,
                "campaign-2": 10,
            });
        });

        it("returns empty result when terminate finds nothing to flip (race with settlement)", async () => {
            const { orchestrator, assetLog, interactionLog, campaignRule } =
                buildOrchestrator();
            vi.mocked(
                interactionLog.findPurchaseInteractionByExternalId
            ).mockResolvedValue(purchaseInteraction);
            vi.mocked(
                assetLog.findCancellableByInteractionLogs
            ).mockResolvedValue([pendingReward()]);
            // Between find and update, the reward moved to `processing`.
            vi.mocked(assetLog.terminateRewardsBatch).mockResolvedValue([]);

            const result = await orchestrator.cancelForRefund({
                merchantId: "m1",
                externalId: "order-42",
            });

            expect(result.affectedCount).toBe(0);
            expect(campaignRule.restoreBudgetsBatch).not.toHaveBeenCalled();
        });
    });

    describe("expireOverdueRewards", () => {
        it("returns empty result when no rewards have expired", async () => {
            const { orchestrator, assetLog, campaignRule } =
                buildOrchestrator();
            vi.mocked(assetLog.findExpiredPendingRewardIds).mockResolvedValue(
                []
            );

            const result = await orchestrator.expireOverdueRewards();

            expect(result.affectedCount).toBe(0);
            expect(assetLog.terminateRewardsBatch).not.toHaveBeenCalled();
            expect(campaignRule.restoreBudgetsBatch).not.toHaveBeenCalled();
        });

        it("flips expired rewards with reason 'expired' and restores budget", async () => {
            const { orchestrator, assetLog, campaignRule } =
                buildOrchestrator();
            vi.mocked(assetLog.findExpiredPendingRewardIds).mockResolvedValue([
                "asset-9",
                "asset-10",
            ]);
            vi.mocked(assetLog.terminateRewardsBatch).mockResolvedValue([
                { id: "asset-9", campaignRuleId: "campaign-3", amount: "5" },
                { id: "asset-10", campaignRuleId: "campaign-3", amount: "8" },
            ]);
            vi.mocked(campaignRule.restoreBudgetsBatch).mockResolvedValue({
                "campaign-3": 13,
            });

            const result = await orchestrator.expireOverdueRewards();

            expect(assetLog.terminateRewardsBatch).toHaveBeenCalledWith(
                ["asset-9", "asset-10"],
                "expired"
            );
            expect(result.affectedCount).toBe(2);
            expect(result.budgetRestoredByCampaign).toEqual({
                "campaign-3": 13,
            });
        });
    });
});
