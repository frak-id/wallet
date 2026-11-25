import { log, productEvents } from "@backend-infrastructure";
import type { CampaignRuleRepository } from "../domain/campaign/repositories/CampaignRuleRepository";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type { CancellationReason } from "../domain/rewards/schemas";
import type { PurchasePayload } from "../domain/rewards/types";
import type { SubscriptionPlanOrchestrator } from "./reward";

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
 * For refunds we void in two atomic UPDATE…RETURNINGs:
 *  1. `interaction_logs.cancelled_at` so the reward calculator can never
 *     spawn fresh rewards from this interaction (and locks the row, so a
 *     concurrent cron run blocks until it commits or sees the cancellation).
 *  2. `asset_logs` rows still in the `pending` lockup window flip to a
 *     terminal non-settled state, plus `restoreBudgetsBatch` for the
 *     released amounts.
 *
 * `processing` and `settled` rewards are out of bounds — the only safety
 * window for a refund is the lockup period configured on the campaign.
 */
export class RewardLifecycleOrchestrator {
    constructor(
        private readonly assetLogRepository: AssetLogRepository,
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly campaignRuleRepository: CampaignRuleRepository,
        private readonly subscriptionPlanOrchestrator: SubscriptionPlanOrchestrator
    ) {}

    /**
     * Cancel any pending rewards triggered by a now-refunded purchase and
     * restore each affected campaign's budget. Idempotent: a second call
     * after the interaction is already cancelled returns an empty result.
     *
     * Safe to invoke even when no purchase interaction exists yet (refund
     * webhook arrived before any claim/identity resolution): the downstream
     * orchestrators inspect the persisted purchase status and create the
     * matching cancelled interaction themselves.
     */
    async cancelForRefund(
        params: CancelForRefundParams
    ): Promise<LifecycleResult> {
        const cancelledInteraction =
            await this.interactionLogRepository.cancelPurchaseInteractionByExternalId(
                params
            );

        if (!cancelledInteraction) {
            log.debug(
                params,
                "Refund cancellation: no active purchase interaction to void"
            );
            return emptyResult();
        }

        const terminated =
            await this.assetLogRepository.cancelPendingByInteractionLogs(
                [cancelledInteraction.id],
                "refund"
            );
        await this.resyncRefundedCycle(cancelledInteraction);

        return this.finalize(terminated, "refund", {
            ...params,
            interactionLogId: cancelledInteraction.id,
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
        this.trackExpiredPlans(terminated);
        return this.finalize(terminated, "expired", { scope: "expiration" });
    }

    /** A refunded cycle takes its step back while the step is unpaid. */
    private async resyncRefundedCycle(interaction: {
        merchantId: string | null;
        identityGroupId: string | null;
        payload: unknown;
    }): Promise<void> {
        const { subscription } = interaction.payload as PurchasePayload;
        if (
            subscription?.state !== "resolved" ||
            !interaction.merchantId ||
            !interaction.identityGroupId
        ) {
            return;
        }
        try {
            await this.subscriptionPlanOrchestrator.syncPlan(
                interaction.merchantId,
                interaction.identityGroupId,
                { rehold: true }
            );
        } catch (error) {
            log.warn(
                { error },
                "Failed to resync the plan of a refunded cycle"
            );
        }
    }

    private trackExpiredPlans(
        terminated: {
            campaignRuleId: string | null;
            identityGroupId: string;
            planStep: number | null;
        }[]
    ): void {
        const byCampaign = new Map<string, { group: string; steps: number }>();
        for (const row of terminated) {
            if (row.planStep === null || !row.campaignRuleId) continue;
            const entry = byCampaign.get(row.campaignRuleId) ?? {
                group: row.identityGroupId,
                steps: 0,
            };
            entry.steps++;
            byCampaign.set(row.campaignRuleId, entry);
        }
        for (const [campaignId, { group, steps }] of byCampaign) {
            productEvents.track("subscription_plan_expired", group, {
                campaign_id: campaignId,
                steps,
            });
        }
    }

    /** Restore campaign budgets and emit a structured log. */
    private async finalize(
        terminated: { campaignRuleId: string | null; amount: string }[],
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
