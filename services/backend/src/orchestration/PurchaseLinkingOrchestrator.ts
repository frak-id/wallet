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

/**
 * Normalize an incoming purchase token so lookups hit the canonical format
 * the webhook side stores.
 *
 * Legacy WooCommerce plugin builds (v1.0 and earlier) sent the bare
 * `wc_order_*` key as the token. The current plugin and the backend's WC
 * webhook handler use `${order_key}_${order_id}` (see
 * `wooCommerceWebhook.ts#buildPurchaseToken`), because `order_key` alone is
 * not guaranteed unique across a store's history (clone/import plugins can
 * reuse a key). Normalizing here keeps old-client claims compatible without
 * a dual-write migration.
 *
 * Shopify / Magento / generic custom tokens don't match the `wc_order_`
 * prefix and pass through untouched.
 *
 * TODO(deprecate): remove once the last v1.0 WP merchant has upgraded to a
 * plugin build that sends composite tokens. The only live consumer today is
 * a single merchant; once telemetry shows zero bare-`wc_order_*` tokens in a
 * full month this helper + its call sites can be deleted.
 */
function normalizePurchaseToken(token: string, orderId: string): string {
    if (!token.startsWith("wc_order_")) {
        return token;
    }
    const expectedSuffix = `_${orderId}`;
    if (token.endsWith(expectedSuffix)) {
        return token;
    }
    return `${token}${expectedSuffix}`;
}

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
        if (params.identityNodes.length === 0) {
            throw new Error(
                "At least one identity node (anon/wallet) is required"
            );
        }

        const normalizedToken = normalizePurchaseToken(
            params.token,
            params.orderId
        );

        const { finalGroupId, merged } =
            await this.identityOrchestrator.resolveAndAssociate(
                params.identityNodes
            );

        const purchase = await this.purchaseRepository.findByOrderAndToken(
            params.orderId,
            normalizedToken
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
            purchaseToken: normalizedToken,
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

        // Persist the resolved identity group on the purchase row whenever
        // it differs from what's currently stored. Covers two cases:
        //   1. Webhook arrived first with no claim → row stored with NULL
        //      identity_group_id; this is the late-claim's chance to attach
        //      the user.
        //   2. The merge above produced a new canonical group id that
        //      supersedes the purchase's previous one.
        if (purchase.identityGroupId !== finalIdentityGroupId) {
            await this.purchaseRepository.updateIdentityGroup(
                purchase.id,
                finalIdentityGroupId
            );
        }

        // Honour the persisted purchase status: a refund/cancel webhook may
        // have arrived between the original webhook and this late SDK claim,
        // in which case the stored purchase is already terminal. The
        // interaction is still recorded (for audit + idempotency) but born
        // cancelled so the reward calculator skips it.
        const isCancelled =
            purchase.status === "refunded" || purchase.status === "cancelled";

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
            cancelled: isCancelled,
        });

        if (interactionLogId) {
            log.info(
                {
                    purchaseId: purchase.id,
                    interactionLogId,
                    identityGroupId: finalIdentityGroupId,
                    cancelled: isCancelled,
                },
                isCancelled
                    ? "Late-claim: created cancelled interaction for refunded/cancelled purchase"
                    : "Late-claim: created interaction for existing purchase"
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
