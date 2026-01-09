import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import type {
    AttributionResult,
    AttributionService,
} from "../domain/attribution/services/AttributionService";
import type {
    CalculatedReward,
    PurchaseContext,
    RuleContext,
} from "../domain/campaign";
import type { RuleEngineService } from "../domain/campaign/services/RuleEngineService";
import type { IdentityResolutionService } from "../domain/identity/services/IdentityResolutionService";
import type { ReferralService } from "../domain/referral";
import type { AssetLogSelect } from "../domain/rewards/db/schema";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type {
    CreateAssetLogParams,
    PurchasePayload,
    RecipientType,
} from "../domain/rewards/types";

export type ProcessPurchaseParams = {
    merchantId: string;
    identityGroupId: string;
    orderId: string;
    externalCustomerId: string;
    amount: number;
    currency: string;
    items: Array<{
        productId?: string;
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
    }>;
    purchaseId: string;
};

export type ProcessPurchaseResult = {
    interactionLogId: string;
    rewards: Array<{
        assetLogId: string;
        recipient: RecipientType;
        amount: number;
        token: Address | null;
    }>;
    budgetExceeded: boolean;
    skippedCampaigns: string[];
    errors: Array<{
        campaignRuleId: string;
        error: string;
    }>;
};

export class RewardOrchestrator {
    constructor(
        readonly interactionLogRepository: InteractionLogRepository,
        readonly assetLogRepository: AssetLogRepository,
        readonly ruleEngineService: RuleEngineService,
        readonly attributionService: AttributionService,
        readonly identityService: IdentityResolutionService,
        readonly referralService: ReferralService
    ) {}

    async processPurchaseRewards(
        params: ProcessPurchaseParams
    ): Promise<ProcessPurchaseResult> {
        const attribution = await this.attributionService.attributeConversion({
            identityGroupId: params.identityGroupId,
            merchantId: params.merchantId,
        });

        const payload: PurchasePayload = {
            orderId: params.orderId,
            externalCustomerId: params.externalCustomerId,
            amount: params.amount,
            currency: params.currency,
            items: params.items,
            purchaseId: params.purchaseId,
            touchpointId: attribution.touchpointId ?? undefined,
        };

        const interactionLog = await this.interactionLogRepository.create({
            type: "purchase",
            identityGroupId: params.identityGroupId,
            merchantId: params.merchantId,
            payload,
        });

        const referrerIdentityGroupId =
            await this.resolveReferrerIdentityGroupId(
                params.merchantId,
                params.identityGroupId,
                attribution
            );

        const purchaseContext: PurchaseContext = {
            orderId: params.orderId,
            amount: params.amount,
            currency: params.currency,
            items: params.items.map((item) => ({
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
            })),
        };

        const userIdentity = await this.identityService.findByIdentifier({
            type: "anonymous_fingerprint",
            value: params.identityGroupId,
        });

        const ruleContext: Omit<RuleContext, "time"> = {
            purchase: purchaseContext,
            attribution: {
                source: attribution.source,
                touchpointId: attribution.touchpointId,
                referrerWallet: attribution.referrerWallet,
            },
            user: {
                identityGroupId: params.identityGroupId,
                walletAddress: userIdentity?.walletAddress ?? null,
            },
        };

        const trigger = attribution.attributed
            ? "referral_purchase"
            : "purchase";
        const evaluationResult = await this.ruleEngineService.evaluateRules({
            merchantId: params.merchantId,
            trigger,
            context: ruleContext,
            referrerIdentityGroupId,
        });

        const assetLogs: AssetLogSelect[] = [];

        if (evaluationResult.rewards.length > 0) {
            const assetParams = this.buildAssetLogParams(
                evaluationResult.rewards,
                params.merchantId,
                interactionLog.id,
                attribution.touchpointId ?? undefined,
                params.purchaseId
            );

            const createdAssets =
                await this.assetLogRepository.createBatch(assetParams);
            assetLogs.push(...createdAssets);
        }

        await this.interactionLogRepository.markProcessed(interactionLog.id);

        log.info(
            {
                interactionLogId: interactionLog.id,
                merchantId: params.merchantId,
                orderId: params.orderId,
                rewardsCreated: assetLogs.length,
                budgetExceeded: evaluationResult.budgetExceeded,
                attribution: attribution.source,
            },
            "Processed purchase rewards"
        );

        return {
            interactionLogId: interactionLog.id,
            rewards: assetLogs.map((asset) => ({
                assetLogId: asset.id,
                recipient: asset.recipientType,
                amount: Number.parseFloat(asset.amount),
                token: asset.tokenAddress,
            })),
            budgetExceeded: evaluationResult.budgetExceeded,
            skippedCampaigns: evaluationResult.skippedCampaigns,
            errors: evaluationResult.errors,
        };
    }

    async rollbackPurchaseRewards(purchaseId: string): Promise<number> {
        const cancelledCount =
            await this.assetLogRepository.cancelByPurchaseId(purchaseId);

        if (cancelledCount > 0) {
            log.info(
                { purchaseId, cancelledCount },
                "Rolled back rewards for purchase"
            );
        }

        return cancelledCount;
    }

    private async resolveReferrerIdentityGroupId(
        merchantId: string,
        refereeIdentityGroupId: string,
        attribution: AttributionResult
    ): Promise<string | undefined> {
        if (!attribution.attributed || !attribution.referrerWallet) {
            return undefined;
        }

        const referrerGroup = await this.identityService.findByIdentifier({
            type: "wallet",
            value: attribution.referrerWallet,
        });

        if (referrerGroup) {
            return referrerGroup.id;
        }

        const referrerId = await this.referralService.getDirectReferrer({
            merchantId,
            identityGroupId: refereeIdentityGroupId,
        });

        return referrerId ?? undefined;
    }

    private buildAssetLogParams(
        rewards: CalculatedReward[],
        merchantId: string,
        interactionLogId: string,
        touchpointId: string | undefined,
        purchaseId: string
    ): CreateAssetLogParams[] {
        return rewards.map((reward) => ({
            identityGroupId: reward.recipientIdentityGroupId,
            merchantId,
            campaignRuleId: reward.campaignRuleId,
            assetType: reward.type,
            amount: reward.amount,
            tokenAddress: reward.token ?? undefined,
            recipientType: reward.recipient,
            recipientWallet: reward.recipientWallet ?? undefined,
            touchpointId,
            purchaseId,
            interactionLogId,
            chainDepth: reward.chainDepth,
        }));
    }
}
