import { log } from "@backend-infrastructure";
import type {
    PurchaseClaimRepository,
    PurchaseInsert,
    PurchaseItemInsert,
    PurchaseRepository,
} from "../domain/purchases";
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

        // Claim exists — use the claiming identity group, store purchase, create interaction
        const identityGroupId = claim.claimingIdentityGroupId;
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
}
