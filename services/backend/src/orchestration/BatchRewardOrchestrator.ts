import { eventEmitter, log } from "@backend-infrastructure";
import { and, eq, isNull } from "drizzle-orm";
import type { Address } from "viem";
import type { ReferralService } from "../domain/attribution";
import { buildTimeContext, type CalculatedReward } from "../domain/campaign";
import type { RuleEngineService } from "../domain/campaign/services/RuleEngineService";
import type { MerchantRepository } from "../domain/merchant/repositories/MerchantRepository";
import {
    type AssetLogSelect,
    assetLogsTable,
    type InteractionLogSelect,
    interactionLogsTable,
} from "../domain/rewards/db/schema";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type {
    CreateAssetLogParams,
    RecipientType,
} from "../domain/rewards/types";
import { db } from "../infrastructure/persistence/postgres";
import type { IdentityOrchestrator } from "./identity";
import type { InteractionContextBuilder } from "./reward";

type BatchProcessResult = {
    processedCount: number;
    rewardsCreated: number;
    errors: {
        interactionLogId: string;
        error: string;
    }[];
};

type ProcessSingleResult = {
    success: boolean;
    rewardsCreated: number;
    /** True when the interaction was already cancelled by a concurrent refund. */
    cancelled?: boolean;
    error?: string;
};

export class BatchRewardOrchestrator {
    constructor(
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly assetLogRepository: AssetLogRepository,
        private readonly ruleEngineService: RuleEngineService,
        private readonly referralService: ReferralService,
        private readonly identityOrchestrator: IdentityOrchestrator,
        private readonly contextBuilder: InteractionContextBuilder,
        private readonly merchantRepository: MerchantRepository
    ) {}

    async processPendingInteractions(options: {
        limit: number;
    }): Promise<BatchProcessResult> {
        const interactions =
            await this.interactionLogRepository.findUnprocessedForRewards({
                limit: options.limit,
            });

        if (interactions.length === 0) {
            return { processedCount: 0, rewardsCreated: 0, errors: [] };
        }

        log.debug(
            { count: interactions.length },
            "Processing pending interactions"
        );

        const result: BatchProcessResult = {
            processedCount: 0,
            rewardsCreated: 0,
            errors: [],
        };

        const interactionsByMerchant = this.groupByMerchant(interactions);

        for (const [
            merchantId,
            merchantInteractions,
        ] of interactionsByMerchant) {
            for (const interaction of merchantInteractions) {
                const processResult = await this.processSingleInteraction(
                    interaction,
                    merchantId
                );

                if (processResult.success) {
                    result.processedCount++;
                    result.rewardsCreated += processResult.rewardsCreated;
                } else if (processResult.error) {
                    result.errors.push({
                        interactionLogId: interaction.id,
                        error: processResult.error,
                    });
                }
            }
        }

        log.info(
            {
                processedCount: result.processedCount,
                rewardsCreated: result.rewardsCreated,
                errorCount: result.errors.length,
            },
            "Batch reward processing completed"
        );

        return result;
    }

    private groupByMerchant(
        interactions: InteractionLogSelect[]
    ): Map<string, InteractionLogSelect[]> {
        const grouped = new Map<string, InteractionLogSelect[]>();

        for (const interaction of interactions) {
            if (!interaction.merchantId) continue;

            const existing = grouped.get(interaction.merchantId) ?? [];
            existing.push(interaction);
            grouped.set(interaction.merchantId, existing);
        }

        return grouped;
    }

    private async processSingleInteraction(
        interaction: InteractionLogSelect,
        merchantId: string
    ): Promise<ProcessSingleResult> {
        try {
            if (!interaction.identityGroupId) {
                return {
                    success: false,
                    rewardsCreated: 0,
                    error: "No identityGroupId on interaction",
                };
            }

            const walletAddress =
                await this.identityOrchestrator.getWalletForGroup(
                    interaction.identityGroupId
                );

            const time = buildTimeContext(interaction.createdAt);

            const { trigger, context, referralLinkId } =
                await this.contextBuilder.build(
                    interaction,
                    merchantId,
                    interaction.identityGroupId,
                    walletAddress
                );

            const evaluationResult = await this.ruleEngineService.evaluateRules(
                {
                    merchantId,
                    trigger,
                    context,
                    time,
                },
                (args) => this.referralService.getReferralChain(args)
            );

            const assetParams =
                evaluationResult.rewards.length > 0
                    ? await this.buildAssetLogParams(
                          evaluationResult.rewards,
                          merchantId,
                          interaction.id,
                          referralLinkId ?? undefined
                      )
                    : [];

            // Atomically: lock the interaction, verify it isn't cancelled, then
            // insert the asset_logs and mark it processed. The `FOR UPDATE`
            // serializes against `cancelPurchaseInteractionByExternalId` so a
            // concurrent refund either:
            //  - blocks until this commits, then sees the freshly-inserted
            //    pending rewards and cancels them, or
            //  - wins the race, in which case we observe `cancelledAt` here
            //    and skip insertion entirely (still marking processed so the
            //    cron never picks this row up again).
            const txOutcome = await db.transaction(async (tx) => {
                const [fresh] = await tx
                    .select({
                        id: interactionLogsTable.id,
                        cancelledAt: interactionLogsTable.cancelledAt,
                    })
                    .from(interactionLogsTable)
                    .where(
                        and(
                            eq(interactionLogsTable.id, interaction.id),
                            isNull(interactionLogsTable.processedAt)
                        )
                    )
                    .for("update")
                    .limit(1);

                if (!fresh) {
                    // Another worker beat us to processing this row.
                    return {
                        cancelled: false,
                        createdAssets: [] as AssetLogSelect[],
                    };
                }

                if (fresh.cancelledAt) {
                    // Refund landed mid-flight — mark processed so the cron
                    // skips this row forever, and skip reward insertion.
                    await tx
                        .update(interactionLogsTable)
                        .set({ processedAt: new Date() })
                        .where(eq(interactionLogsTable.id, interaction.id));
                    return {
                        cancelled: true,
                        createdAssets: [] as AssetLogSelect[],
                    };
                }

                let createdAssets: AssetLogSelect[] = [];
                if (assetParams.length > 0) {
                    createdAssets = await tx
                        .insert(assetLogsTable)
                        .values(
                            this.assetLogRepository.buildInserts(assetParams)
                        )
                        .returning();
                }

                await tx
                    .update(interactionLogsTable)
                    .set({ processedAt: new Date() })
                    .where(eq(interactionLogsTable.id, interaction.id));

                return { cancelled: false, createdAssets };
            });

            if (txOutcome.createdAssets.length > 0) {
                try {
                    await this.sendRewardPendingNotifications(
                        txOutcome.createdAssets,
                        merchantId
                    );
                } catch (error) {
                    log.warn(
                        { error },
                        "Failed to send reward pending notifications"
                    );
                }
            }

            log.debug(
                {
                    interactionLogId: interaction.id,
                    interactionType: interaction.type,
                    merchantId,
                    trigger,
                    rewardsCreated: txOutcome.createdAssets.length,
                    cancelled: txOutcome.cancelled,
                    budgetExceeded: evaluationResult.budgetExceeded,
                },
                txOutcome.cancelled
                    ? "Skipped reward creation — interaction cancelled mid-flight"
                    : "Processed interaction rewards"
            );

            return {
                success: true,
                rewardsCreated: txOutcome.createdAssets.length,
                cancelled: txOutcome.cancelled,
            };
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);

            log.error(
                {
                    interactionLogId: interaction.id,
                    interactionType: interaction.type,
                    error: errorMessage,
                },
                "Failed to process interaction"
            );

            return {
                success: false,
                rewardsCreated: 0,
                error: errorMessage,
            };
        }
    }

    private async buildAssetLogParams(
        rewards: CalculatedReward[],
        merchantId: string,
        interactionLogId: string,
        referralLinkId: string | undefined
    ): Promise<CreateAssetLogParams[]> {
        const hasTokenTypeWithoutToken = rewards.some(
            (r) => r.type === "token" && !r.token
        );
        const fallbackToken = hasTokenTypeWithoutToken
            ? await this.merchantRepository.getDefaultRewardToken(merchantId)
            : null;

        const params: CreateAssetLogParams[] = [];

        for (const reward of rewards) {
            const resolvedToken = reward.token ?? fallbackToken ?? undefined;

            if (reward.type === "token" && !resolvedToken) {
                log.warn(
                    {
                        merchantId,
                        campaignRuleId: reward.campaignRuleId,
                        interactionLogId,
                        recipient: reward.recipient,
                    },
                    "Skipping token reward with no resolved token address"
                );
                continue;
            }

            params.push({
                identityGroupId: reward.recipientIdentityGroupId,
                merchantId,
                campaignRuleId: reward.campaignRuleId,
                assetType: reward.type,
                amount: reward.amount,
                tokenAddress: resolvedToken,
                recipientType: reward.recipient as RecipientType,
                referralLinkId,
                interactionLogId,
                chainDepth: reward.chainDepth,
                expirationDays: reward.expirationDays,
                lockupSeconds: reward.lockupSeconds,
            });
        }

        return params;
    }

    private async sendRewardPendingNotifications(
        assets: { identityGroupId: string }[],
        merchantId: string
    ) {
        if (assets.length === 0) return;

        const walletCounts = new Map<Address, number>();
        for (const asset of assets) {
            const wallet = await this.identityOrchestrator.getWalletForGroup(
                asset.identityGroupId
            );
            if (!wallet) continue;
            walletCounts.set(wallet, (walletCounts.get(wallet) ?? 0) + 1);
        }

        eventEmitter.emit("notification", {
            type: "reward_pending",
            notifications: [...walletCounts.entries()].map(
                ([wallet, rewardCount]) => ({
                    wallets: [wallet] as Address[],
                    merchantId,
                    rewardCount,
                })
            ),
        });
    }
}
