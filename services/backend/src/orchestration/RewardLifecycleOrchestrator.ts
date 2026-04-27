import { log } from "@backend-infrastructure";
import type { CampaignRuleRepository } from "../domain/campaign/repositories/CampaignRuleRepository";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type { CancellationReason } from "../domain/rewards/schemas";

type CancelForRefundParams = {
    merchantId: string;
    /** Platform order id (e.g. Shopify `order.id`, WC `order_id`). */
    externalId: string;
};

type LifecycleResult = {
    /** Number of rewards moved to a terminal non-settled state. */
    affectedCount: number;
    /** Total amount restored to each campaign budget, keyed by `campaignRuleId`. */
    budgetRestoredByCampaign: Record<string, number>;
};

const emptyResult = (): LifecycleResult => ({
    affectedCount: 0,
    budgetRestoredByCampaign: {},
});

/**
 * Owns the post-creation lifecycle of `pending` rewards: refund-driven
 * cancellation and natural expiration.
 *
 * Both flows reduce to one atomic UPDATE…RETURNING in `AssetLogRepository`
 * that flips the eligible rows to a terminal non-settled state, plus a
 * `restoreBudgetsBatch` call for the released amounts.
 *
 * `processing` and `settled` rewards are out of bounds — the only safety
 * window for a refund is the lockup period configured on the campaign.
 */
export class RewardLifecycleOrchestrator {
    constructor(
        private readonly assetLogRepository: AssetLogRepository,
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly campaignRuleRepository: CampaignRuleRepository
    ) {}

    /**
     * Cancel any pending rewards triggered by a now-refunded purchase and
     * restore each affected campaign's budget. Idempotent: a second call
     * after all rewards are already cancelled returns an empty result.
     */
    async cancelForRefund(
        params: CancelForRefundParams
    ): Promise<LifecycleResult> {
        const interaction =
            await this.interactionLogRepository.findPurchaseInteractionByExternalId(
                params
            );

        if (!interaction) {
            log.debug(
                params,
                "Refund cancellation: no purchase interaction found, nothing to cancel"
            );
            return emptyResult();
        }

        const terminated =
            await this.assetLogRepository.cancelPendingByInteractionLogs(
                [interaction.id],
                "refund"
            );

        return this.finalize(terminated, "refund", {
            ...params,
            scope: "refund",
        });
    }

    /**
     * Find rewards whose expiration has elapsed, mark them `expired`, and
     * restore their campaigns' budget. Driven by the daily expiration cron.
     */
    async expireOverdueRewards(): Promise<LifecycleResult> {
        const terminated =
            await this.assetLogRepository.expirePendingPastDeadline();
        return this.finalize(terminated, "expired", { scope: "expiration" });
    }

    /** Restore campaign budgets and emit a structured log. */
    private async finalize(
        terminated: { campaignRuleId: string; amount: string }[],
        reason: CancellationReason,
        logCtx: Record<string, unknown>
    ): Promise<LifecycleResult> {
        if (terminated.length === 0) {
            return emptyResult();
        }

        const budgetRestoredByCampaign =
            await this.campaignRuleRepository.restoreBudgetsBatch(terminated);

        log.info(
            {
                ...logCtx,
                reason,
                affectedCount: terminated.length,
                budgetRestoredByCampaign,
            },
            "Reward lifecycle: terminated rewards and restored budgets"
        );

        return {
            affectedCount: terminated.length,
            budgetRestoredByCampaign,
        };
    }
}
