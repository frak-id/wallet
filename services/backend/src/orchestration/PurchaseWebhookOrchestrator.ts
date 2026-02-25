import { log } from "@backend-infrastructure";
import type { IdentityRepository } from "../domain/identity/repositories/IdentityRepository";
import type {
    PurchaseClaimRepository,
    PurchaseInsert,
    PurchaseItemInsert,
    PurchaseRepository,
} from "../domain/purchases";
import type { IdentityOrchestrator } from "./identity";
import type { PurchaseInteractionCreator } from "./PurchaseInteractionCreator";

type UpsertPurchaseParams = {
    purchase: PurchaseInsert;
    purchaseItems: PurchaseItemInsert[];
    merchantId: string;
};

type UpsertPurchaseResult = {
    purchaseId: string;
    identityGroupId: string | null;
    interactionLogId: string | null;
    isDuplicate: boolean;
    pendingClaim: boolean;
};

export class PurchaseWebhookOrchestrator {
    constructor(
        private readonly purchaseRepository: PurchaseRepository,
        private readonly purchaseClaimRepository: PurchaseClaimRepository,
        private readonly identityRepository: IdentityRepository,
        private readonly identityOrchestrator: IdentityOrchestrator,
        private readonly purchaseInteractionCreator: PurchaseInteractionCreator
    ) {}

    async upsertPurchase({
        purchase,
        purchaseItems,
        merchantId,
    }: UpsertPurchaseParams): Promise<UpsertPurchaseResult> {
        // Check if a claim exists for this purchase
        const claim = await this.purchaseClaimRepository.findByPurchaseKey({
            merchantId,
            orderId: purchase.externalId,
            purchaseToken: purchase.purchaseToken ?? "",
        });

        if (!claim) {
            // No claim yet — store the purchase and wait for the claim to arrive.
            // The interaction will be created when PurchaseLinkingOrchestrator
            // reconciles the late claim with this purchase.
            const purchaseId = await this.purchaseRepository.upsertWithItems({
                purchase,
                items: purchaseItems,
            });

            log.info(
                {
                    purchaseId,
                    merchantId,
                    orderId: purchase.externalId,
                },
                "Purchase stored, pending claim for interaction creation"
            );

            return {
                purchaseId,
                identityGroupId: null,
                interactionLogId: null,
                isDuplicate: false,
                pendingClaim: true,
            };
        }

        // Claim exists — resolve identity, store purchase, create interaction
        const identityGroupId = await this.resolveWithValidatedClaim(claim, {
            merchantId,
            customerId: purchase.externalCustomerId,
        });
        await this.purchaseClaimRepository.delete(claim.id);

        const purchaseId = await this.purchaseRepository.upsertWithItems({
            purchase,
            items: purchaseItems,
            identityGroupId,
        });

        const interactionLogId = await this.purchaseInteractionCreator.create({
            purchaseId,
            externalId: purchase.externalId,
            externalCustomerId: purchase.externalCustomerId,
            totalPrice: purchase.totalPrice,
            currencyCode: purchase.currencyCode,
            items: purchaseItems.map((item) => ({
                externalId: item.externalId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
            })),
            identityGroupId,
            merchantId,
        });

        return {
            purchaseId,
            identityGroupId,
            interactionLogId,
            isDuplicate: interactionLogId === null,
            pendingClaim: false,
        };
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
            const { finalGroupId } = await this.identityOrchestrator.associate(
                claim.claimingIdentityGroupId,
                existingGroup.id
            );

            log.info(
                {
                    claimingGroupId: claim.claimingIdentityGroupId,
                    existingGroupId: existingGroup.id,
                    finalGroupId,
                },
                "Merged claiming group into existing merchant_customer group"
            );

            return finalGroupId;
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
