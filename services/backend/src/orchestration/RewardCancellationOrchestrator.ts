import { log } from "@backend-infrastructure";
import type { CampaignRuleRepository } from "../domain/campaign/repositories/CampaignRuleRepository";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type { CancellationReason } from "../domain/rewards/schemas";

type CancelForRefundParams = {
    merchantId: string;
    /** Platform order id (e.g. Shopify `order.id`, WC `order_id`). */
    externalId: string;
    /** `partial_refund` for split refunds, `refund` for full ones. */
    reason: Extract<CancellationReason, "refund" | "partial_refund">;
};

type CancelForRefundResult = {
    cancelledCount: number;
    budgetRestoredByCampaign: Record<string, number>;
};

const EMPTY_RESULT: CancelForRefundResult = {
    cancelledCount: 0,
    budgetRestoredByCampaign: {},
};

/**
 * Orchestrates the cancellation of pending rewards triggered by a now-refunded
 * purchase, then restores the campaign budget so the cancelled amounts can be
 * spent on future conversions.
 *
 * The lockup window (`asset_logs.available_at`) is the protection envelope:
 * any reward still in `pending` status when a refund webhook lands is fair
 * game for cancellation, locked or not. Settled rewards on-chain are never
 * touched — the lockup is the only refund-protection window by design.
 */
export class RewardCancellationOrchestrator {
    constructor(
        private readonly assetLogRepository: AssetLogRepository,
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly campaignRuleRepository: CampaignRuleRepository
    ) {}

    /**
     * Cancel any pending rewards associated with the refunded purchase and
     * restore each affected campaign's budget. Idempotent: a second call
     * after all rewards are already cancelled returns an empty result.
     */
    async cancelForRefund(
        params: CancelForRefundParams
    ): Promise<CancelForRefundResult> {
        const interactions =
            await this.interactionLogRepository.findPurchaseInteractionsByExternalId(
                {
                    merchantId: params.merchantId,
                    externalId: params.externalId,
                }
            );

        if (interactions.length === 0) {
            log.debug(
                {
                    merchantId: params.merchantId,
                    externalId: params.externalId,
                },
                "Refund cancellation: no purchase interaction found, nothing to cancel"
            );
            return EMPTY_RESULT;
        }

        const cancellable =
            await this.assetLogRepository.findCancellableByInteractionLogs(
                interactions.map((i) => i.id)
            );

        if (cancellable.length === 0) {
            log.debug(
                {
                    merchantId: params.merchantId,
                    externalId: params.externalId,
                },
                "Refund cancellation: no pending rewards to cancel (already settled or expired)"
            );
            return EMPTY_RESULT;
        }

        const cancelled = await this.assetLogRepository.cancelBatch(
            cancellable.map((r) => r.id),
            params.reason
        );

        const budgetRestoredByCampaign = await this.restoreBudgets(cancelled);

        log.info(
            {
                merchantId: params.merchantId,
                externalId: params.externalId,
                reason: params.reason,
                cancelledCount: cancelled.length,
                budgetRestoredByCampaign,
            },
            "Refund cancellation: cancelled pending rewards and restored budgets"
        );

        return {
            cancelledCount: cancelled.length,
            budgetRestoredByCampaign,
        };
    }

    private async restoreBudgets(
        cancelled: {
            campaignRuleId: string | null;
            amount: string;
        }[]
    ): Promise<Record<string, number>> {
        const amountsByCampaign = new Map<string, number>();
        for (const reward of cancelled) {
            if (!reward.campaignRuleId) continue;
            const current = amountsByCampaign.get(reward.campaignRuleId) ?? 0;
            amountsByCampaign.set(
                reward.campaignRuleId,
                current + Number.parseFloat(reward.amount)
            );
        }

        const restored: Record<string, number> = {};
        for (const [campaignRuleId, amount] of amountsByCampaign) {
            await this.campaignRuleRepository.restoreBudget(
                campaignRuleId,
                amount
            );
            restored[campaignRuleId] = amount;
        }
        return restored;
    }
}
