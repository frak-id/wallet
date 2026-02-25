import { log } from "@backend-infrastructure";
import type {
    PurchaseClaimRepository,
    PurchaseRepository,
    PurchaseSelect,
} from "../domain/purchases";
import type { IdentityNode, IdentityOrchestrator } from "./identity";
import type { PurchaseInteractionCreator } from "./PurchaseInteractionCreator";

type ClaimPurchaseParams = {
    identityNodes: IdentityNode[];
    merchantId: string;
    customerId: string;
    orderId: string;
    token: string;
};

type ClaimPurchaseResult = {
    success: boolean;
    identityGroupId: string;
    purchaseId?: string;
    pendingWebhook?: boolean;
    merged?: boolean;
};

export class PurchaseLinkingOrchestrator {
    constructor(
        private readonly purchaseRepository: PurchaseRepository,
        private readonly purchaseClaimRepository: PurchaseClaimRepository,
        private readonly identityOrchestrator: IdentityOrchestrator,
        private readonly purchaseInteractionCreator: PurchaseInteractionCreator
    ) {}

    async claimPurchase(
        params: ClaimPurchaseParams
    ): Promise<ClaimPurchaseResult> {
        // Security: Only resolve trusted identity types (anon/wallet), NOT merchant_customer
        // merchant_customer is only created after webhook validates the claim
        const trustedNodes = params.identityNodes.filter(
            (n) => n.type !== "merchant_customer"
        );

        if (trustedNodes.length === 0) {
            throw new Error(
                "At least one trusted identity node (anon/wallet) is required"
            );
        }

        const { finalGroupId, merged } =
            await this.identityOrchestrator.resolveAndAssociate(trustedNodes);

        const purchase = await this.purchaseRepository.findByOrderAndToken(
            params.orderId,
            params.token
        );

        if (purchase) {
            // Webhook already arrived — reconcile identities and create interaction
            return this.reconcileWithExistingPurchase(
                purchase,
                finalGroupId,
                merged,
                params.merchantId
            );
        }

        await this.purchaseClaimRepository.upsert({
            merchantId: params.merchantId,
            customerId: params.customerId,
            orderId: params.orderId,
            purchaseToken: params.token,
            claimingIdentityGroupId: finalGroupId,
        });

        log.debug(
            { identityGroupId: finalGroupId, orderId: params.orderId },
            "Created purchase claim, awaiting webhook validation"
        );

        return {
            success: true,
            identityGroupId: finalGroupId,
            pendingWebhook: true,
        };
    }

    private async reconcileWithExistingPurchase(
        purchase: PurchaseSelect,
        claimingGroupId: string,
        alreadyMerged: boolean,
        merchantId: string
    ): Promise<ClaimPurchaseResult> {
        let finalIdentityGroupId = claimingGroupId;
        let merged = alreadyMerged;

        if (
            purchase.identityGroupId &&
            purchase.identityGroupId !== claimingGroupId
        ) {
            const { finalGroupId } = await this.identityOrchestrator.associate(
                claimingGroupId,
                purchase.identityGroupId
            );

            log.info(
                {
                    purchaseId: purchase.id,
                    claimingGroupId,
                    purchaseGroupId: purchase.identityGroupId,
                    finalGroupId,
                },
                "Merged claiming group with purchase group"
            );

            finalIdentityGroupId = finalGroupId;
            merged = true;
        }

        // Create the interaction now that we have a claimed identity.
        // The webhook stored the purchase data but deferred interaction
        // creation until a claim arrived.
        const items = await this.purchaseRepository.findItemsByPurchaseId(
            purchase.id
        );

        const interactionLogId = await this.purchaseInteractionCreator.create({
            purchaseId: purchase.id,
            externalId: purchase.externalId,
            externalCustomerId: purchase.externalCustomerId,
            totalPrice: purchase.totalPrice,
            currencyCode: purchase.currencyCode,
            items: items.map((item) => ({
                externalId: item.externalId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
            })),
            identityGroupId: finalIdentityGroupId,
            merchantId,
        });

        if (interactionLogId) {
            log.info(
                {
                    purchaseId: purchase.id,
                    interactionLogId,
                    identityGroupId: finalIdentityGroupId,
                },
                "Late-claim: created interaction for existing purchase"
            );
        }

        return {
            success: true,
            purchaseId: purchase.id,
            identityGroupId: finalIdentityGroupId,
            merged,
        };
    }
}
