import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import type { ReferralService } from "../domain/attribution";
import type { AttributionService } from "../domain/attribution/services/AttributionService";
import {
    buildTimeContext,
    type CalculatedReward,
    type CampaignTrigger,
    type PurchaseContext,
    type RuleContext,
} from "../domain/campaign";
import type { RuleEngineService } from "../domain/campaign/services/RuleEngineService";
import type { InteractionLogSelect } from "../domain/rewards/db/schema";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type {
    CreateAssetLogParams,
    PurchasePayload,
    RecipientType,
    WalletConnectPayload,
} from "../domain/rewards/types";
import type { IdentityOrchestrator } from "./identity";

type BatchProcessResult = {
    processedCount: number;
    rewardsCreated: number;
    errors: Array<{
        interactionLogId: string;
        error: string;
    }>;
};

type ProcessSingleResult = {
    success: boolean;
    rewardsCreated: number;
    error?: string;
};

export class BatchRewardOrchestrator {
    constructor(
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly assetLogRepository: AssetLogRepository,
        private readonly ruleEngineService: RuleEngineService,
        private readonly attributionService: AttributionService,
        private readonly referralService: ReferralService,
        private readonly identityOrchestrator: IdentityOrchestrator
    ) {}

    async processPendingInteractions(options: {
        limit: number;
        minAgeSeconds: number;
    }): Promise<BatchProcessResult> {
        const interactions =
            await this.interactionLogRepository.findUnprocessedForRewards({
                limit: options.limit,
                minAgeSeconds: options.minAgeSeconds,
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

        const processedIds: string[] = [];
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
                    processedIds.push(interaction.id);
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

        if (processedIds.length > 0) {
            await this.interactionLogRepository.markProcessedBatch(
                processedIds
            );
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

            const { trigger, context } = await this.buildContextForInteraction(
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
                this.referralService.getReferralChain
            );

            let rewardsCreated = 0;

            if (evaluationResult.rewards.length > 0) {
                const touchpointId =
                    context.attribution?.touchpointId ?? undefined;

                const assetParams = this.buildAssetLogParams(
                    evaluationResult.rewards,
                    merchantId,
                    interaction.id,
                    touchpointId
                );

                const createdAssets =
                    await this.assetLogRepository.createBatch(assetParams);
                rewardsCreated = createdAssets.length;
            }

            log.debug(
                {
                    interactionLogId: interaction.id,
                    interactionType: interaction.type,
                    merchantId,
                    trigger,
                    rewardsCreated,
                    budgetExceeded: evaluationResult.budgetExceeded,
                },
                "Processed interaction rewards"
            );

            return { success: true, rewardsCreated };
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

    private async buildContextForInteraction(
        interaction: InteractionLogSelect,
        merchantId: string,
        identityGroupId: string,
        walletAddress: Address | null
    ): Promise<{
        trigger: CampaignTrigger;
        context: Omit<RuleContext, "time">;
    }> {
        const attribution = await this.attributionService.attributeConversion({
            identityGroupId,
            merchantId,
        });

        const referrerIdentityGroupId = attribution.referrerWallet
            ? await this.identityOrchestrator.findGroupIdByWallet(
                  attribution.referrerWallet
              )
            : null;

        const { trigger, typeContext, walletAddressOverride } =
            this.buildTypeSpecificContext(interaction, walletAddress);

        return {
            trigger,
            context: {
                ...typeContext,
                attribution: {
                    source: attribution.source,
                    touchpointId: attribution.touchpointId,
                    referrerWallet: attribution.referrerWallet,
                    referrerIdentityGroupId,
                },
                user: {
                    identityGroupId,
                    walletAddress: walletAddressOverride ?? walletAddress,
                },
            },
        };
    }

    private buildTypeSpecificContext(
        interaction: InteractionLogSelect,
        walletAddress: Address | null
    ): {
        trigger: CampaignTrigger;
        typeContext: { purchase?: PurchaseContext };
        walletAddressOverride?: Address | null;
    } {
        switch (interaction.type) {
            case "purchase": {
                const payload = interaction.payload as PurchasePayload;
                return {
                    trigger: "purchase",
                    typeContext: {
                        purchase: {
                            orderId: payload.orderId,
                            amount: payload.amount,
                            currency: payload.currency,
                            items: payload.items.map((item) => ({
                                productId: item.productId,
                                name: item.name,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                totalPrice: item.totalPrice,
                            })),
                        },
                    },
                };
            }

            case "wallet_connect": {
                const payload = interaction.payload as WalletConnectPayload;
                return {
                    trigger: "wallet_connect",
                    typeContext: {},
                    walletAddressOverride: payload.wallet ?? walletAddress,
                };
            }

            default:
                return {
                    trigger: "custom",
                    typeContext: {},
                };
        }
    }

    private buildAssetLogParams(
        rewards: CalculatedReward[],
        merchantId: string,
        interactionLogId: string,
        touchpointId: string | undefined
    ): CreateAssetLogParams[] {
        return rewards.map((reward) => ({
            identityGroupId: reward.recipientIdentityGroupId,
            merchantId,
            campaignRuleId: reward.campaignRuleId,
            assetType: reward.type,
            amount: reward.amount,
            tokenAddress: reward.token ?? undefined,
            recipientType: reward.recipient as RecipientType,
            recipientWallet: reward.recipientWallet ?? undefined,
            touchpointId,
            interactionLogId,
            chainDepth: reward.chainDepth,
        }));
    }
}
