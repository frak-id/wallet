import { log } from "@backend-infrastructure";
import type {
    PurchaseClaimRepository,
    PurchaseInsert,
    PurchaseItemInsert,
    PurchaseRepository,
} from "../domain/purchases";
import type { IdentityNode, IdentityOrchestrator } from "./identity";
import type { PurchaseInteractionCreator } from "./PurchaseInteractionCreator";

type UpsertPurchaseParams = {
    purchase: PurchaseInsert;
    purchaseItems: PurchaseItemInsert[];
    merchantId: string;
    /** Anonymous client ID from Shopify cart note_attributes (ad-blocker-resistant identity) */
    clientId?: string;
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
        private readonly purchaseInteractionCreator: PurchaseInteractionCreator,
        private readonly identityOrchestrator: IdentityOrchestrator
    ) {}

    async upsertPurchase({
        purchase,
        purchaseItems,
        merchantId,
        clientId,
    }: UpsertPurchaseParams): Promise<UpsertPurchaseResult> {
        // Check if a claim exists for this purchase
        const claim = await this.purchaseClaimRepository.findByPurchaseKey({
            merchantId,
            orderId: purchase.externalId,
            purchaseToken: purchase.purchaseToken ?? "",
        });

        // Claim + client present, check they match (claim will take over client id)
        if (claim?.claimingIdentityGroupId && clientId) {
            log.debug(
                {
                    claimIdentityGroupId: claim.claimingIdentityGroupId,
                    purchaseClientId: clientId,
                },
                "Got both a pending claim, and client id note for a purchase"
            );
        }

        // No claim from pixel — try cart-attribute identity (ad-blocker-resistant path)
        if (!claim && clientId) {
            log.debug(
                {
                    clientId,
                    merchantId,
                    purchaseId: purchase.externalId,
                },
                "Resolved client id from webhook data"
            );
            return this.upsertWithCartAttributeIdentity({
                purchase,
                purchaseItems,
                merchantId,
                clientId,
            });
        }

        if (!claim) {
            // No claim, no cart-attribute identity — store the purchase and wait.
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

    /**
     * Cart-attribute identity path: resolve identity from the anonymous client ID
     * written to Shopify cart attributes by the SDK, which flows through to the
     * webhook as note_attributes. This bypasses ad-blockers that block the pixel.
     */
    private async upsertWithCartAttributeIdentity(params: {
        purchase: PurchaseInsert;
        purchaseItems: PurchaseItemInsert[];
        merchantId: string;
        clientId: string;
    }): Promise<UpsertPurchaseResult> {
        const { purchase, purchaseItems, merchantId, clientId } = params;

        // Resolve anonymous fingerprint to an identity group
        const identityNode: IdentityNode = {
            type: "anonymous_fingerprint",
            value: clientId,
            merchantId,
        };
        const { finalGroupId: identityGroupId } =
            await this.identityOrchestrator.resolveAndAssociate([identityNode]);

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

        log.info(
            {
                purchaseId,
                identityGroupId,
                interactionLogId,
                merchantId,
                orderId: purchase.externalId,
            },
            "Cart-attribute identity: resolved purchase from note_attributes"
        );

        return {
            purchaseId,
            identityGroupId,
            interactionLogId,
            isDuplicate: interactionLogId === null,
            pendingClaim: false,
        };
    }
}
