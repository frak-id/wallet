import { log } from "@backend-infrastructure";
import type {
    PurchaseClaimRepository,
    PurchaseRepository,
} from "../domain/purchases";
import type { IdentityNode, IdentityOrchestrator } from "./identity";

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
        private readonly identityOrchestrator: IdentityOrchestrator
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
            // Validation: finding the purchase by orderId+token proves caller knows the real purchase
            return this.reconcileWithExistingPurchase(
                purchase,
                finalGroupId,
                merged
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
        purchase: { id: string; identityGroupId: string | null },
        claimingGroupId: string,
        alreadyMerged: boolean
    ): Promise<ClaimPurchaseResult> {
        if (
            purchase.identityGroupId &&
            purchase.identityGroupId !== claimingGroupId
        ) {
            await this.identityOrchestrator.associate(
                claimingGroupId,
                purchase.identityGroupId
            );

            log.info(
                {
                    purchaseId: purchase.id,
                    claimingGroupId,
                    purchaseGroupId: purchase.identityGroupId,
                },
                "Merged claiming group with purchase group"
            );

            return {
                success: true,
                purchaseId: purchase.id,
                identityGroupId: purchase.identityGroupId,
                merged: true,
            };
        }

        return {
            success: true,
            purchaseId: purchase.id,
            identityGroupId: purchase.identityGroupId ?? claimingGroupId,
            merged: alreadyMerged,
        };
    }
}
