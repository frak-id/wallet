import { eventEmitter, log } from "@backend-infrastructure";
import type { IdentityRepository } from "../domain/identity/repositories/IdentityRepository";
import type {
    PurchaseClaimRepository,
    PurchaseInsert,
    PurchaseItemInsert,
    PurchaseRepository,
} from "../domain/purchases";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type { PurchasePayload } from "../domain/rewards/types";
import type { IdentityOrchestrator } from "./identity";

type UpsertPurchaseParams = {
    purchase: PurchaseInsert;
    purchaseItems: PurchaseItemInsert[];
    merchantId: string;
};

type UpsertPurchaseResult = {
    purchaseId: string;
    identityGroupId: string;
    interactionLogId: string;
};

export class PurchaseWebhookOrchestrator {
    constructor(
        private readonly purchaseRepository: PurchaseRepository,
        private readonly purchaseClaimRepository: PurchaseClaimRepository,
        private readonly identityRepository: IdentityRepository,
        private readonly identityOrchestrator: IdentityOrchestrator,
        private readonly interactionLogRepository: InteractionLogRepository
    ) {}

    async upsertPurchase({
        purchase,
        purchaseItems,
        merchantId,
    }: UpsertPurchaseParams): Promise<UpsertPurchaseResult> {
        const identityGroupId = await this.resolveIdentityForPurchase({
            merchantId,
            customerId: purchase.externalCustomerId,
            orderId: purchase.externalId,
            purchaseToken: purchase.purchaseToken ?? "",
        });

        const purchaseId = await this.purchaseRepository.upsertWithItems({
            purchase,
            items: purchaseItems,
            identityGroupId,
        });

        const payload: PurchasePayload = {
            orderId: purchase.externalId,
            externalCustomerId: purchase.externalCustomerId,
            amount: Number(purchase.totalPrice),
            currency: purchase.currencyCode,
            items: purchaseItems.map((item) => ({
                productId: item.externalId,
                name: item.name,
                quantity: item.quantity,
                unitPrice: Number(item.price),
                totalPrice: Number(item.price) * item.quantity,
            })),
            purchaseId,
        };

        const interactionLog = await this.interactionLogRepository.create({
            type: "purchase",
            identityGroupId,
            merchantId,
            payload,
        });

        eventEmitter.emit("newInteraction", { type: "purchase" });

        log.info(
            {
                purchaseId,
                identityGroupId,
                interactionLogId: interactionLog.id,
            },
            "Purchase processed with identity"
        );

        return {
            purchaseId,
            identityGroupId,
            interactionLogId: interactionLog.id,
        };
    }

    private async resolveIdentityForPurchase(params: {
        merchantId: string;
        customerId: string;
        orderId: string;
        purchaseToken: string;
    }): Promise<string> {
        const claim = await this.purchaseClaimRepository.findByPurchaseKey({
            merchantId: params.merchantId,
            orderId: params.orderId,
            purchaseToken: params.purchaseToken,
        });

        if (claim) {
            const groupId = await this.resolveWithValidatedClaim(claim, params);
            await this.purchaseClaimRepository.delete(claim.id);
            return groupId;
        }

        const { groupId } = await this.identityOrchestrator.resolve({
            type: "merchant_customer",
            value: params.customerId,
            merchantId: params.merchantId,
        });

        return groupId;
    }

    private async resolveWithValidatedClaim(
        claim: { claimingIdentityGroupId: string },
        params: { merchantId: string; customerId: string }
    ): Promise<string> {
        const existingGroup = await this.identityRepository.findGroupByIdentity(
            {
                type: "merchant_customer",
                value: params.customerId,
                merchantId: params.merchantId,
            }
        );

        if (
            existingGroup &&
            existingGroup.id !== claim.claimingIdentityGroupId
        ) {
            await this.identityOrchestrator.associate(
                claim.claimingIdentityGroupId,
                existingGroup.id
            );

            log.info(
                {
                    claimingGroupId: claim.claimingIdentityGroupId,
                    existingGroupId: existingGroup.id,
                },
                "Merged claiming group into existing merchant_customer group"
            );

            return existingGroup.id;
        }

        if (!existingGroup) {
            await this.identityRepository.addNode({
                groupId: claim.claimingIdentityGroupId,
                type: "merchant_customer",
                value: params.customerId,
                merchantId: params.merchantId,
            });
        }

        return claim.claimingIdentityGroupId;
    }
}
