import { log } from "@backend-infrastructure";
import {
    type AttributionResult,
    AttributionService,
} from "../../attribution/services/AttributionService";
import type {
    CalculatedReward,
    PurchaseContext,
    RuleContext,
} from "../../campaign";
import { RuleEngineService } from "../../campaign/services/RuleEngineService";
import { IdentityResolutionService } from "../../identity/services/IdentityResolutionService";
import { ReferralService } from "../../referral";
import type { AssetLogSelect } from "../db/schema";
import { AssetLogRepository } from "../repositories/AssetLogRepository";
import { InteractionLogRepository } from "../repositories/InteractionLogRepository";
import type {
    CreateAssetLogParams,
    ProcessPurchaseResult,
    PurchasePayload,
} from "../types";

type ProcessPurchaseParams = {
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

export class RewardProcessingService {
    private readonly interactionLogRepository: InteractionLogRepository;
    private readonly assetLogRepository: AssetLogRepository;
    private readonly ruleEngineService: RuleEngineService;
    private readonly attributionService: AttributionService;
    private readonly identityService: IdentityResolutionService;
    private readonly referralService: ReferralService;

    constructor(
        interactionLogRepository?: InteractionLogRepository,
        assetLogRepository?: AssetLogRepository,
        ruleEngineService?: RuleEngineService,
        attributionService?: AttributionService,
        identityService?: IdentityResolutionService,
        referralService?: ReferralService
    ) {
        this.interactionLogRepository =
            interactionLogRepository ?? new InteractionLogRepository();
        this.assetLogRepository =
            assetLogRepository ?? new AssetLogRepository();
        this.ruleEngineService = ruleEngineService ?? new RuleEngineService();
        this.attributionService =
            attributionService ?? new AttributionService();
        this.identityService =
            identityService ?? new IdentityResolutionService();
        this.referralService = referralService ?? new ReferralService();
    }

    async processPurchase(
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

        const referrerIdentityGroupId = await this.getReferrerIdentityGroupId(
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
            "Processed purchase event"
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

    async rollbackPurchase(purchaseId: string): Promise<number> {
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

    private async getReferrerIdentityGroupId(
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
