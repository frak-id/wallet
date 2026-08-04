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
    /**
     * Whether identity groups may be merged while claiming this purchase.
     * Defaults to `true` for the trusted, server-to-server webhook path
     * (`PurchaseWebhookOrchestrator`), where merging is correct and
     * desirable. The SDK-facing `/track/purchase` route passes `false`: it
     * is reachable with an unauthenticated `x-frak-client-id`, so it must
     * only ever attribute to an existing group, never reassign one.
     */
    merge?: boolean;
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
        const merge = params.merge ?? true;

        let finalGroupId: string;
        let merged: boolean;
        if (merge) {
            ({ finalGroupId, merged } =
                await this.identityOrchestrator.resolveAndAssociate(
                    params.identityNodes
                ));
        } else {
            ({ groupId: finalGroupId } =
                await this.identityOrchestrator.resolveForAttribution(
                    params.identityNodes
                ));
            merged = false;
        }

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
                params.merchantId,
                merge
            );
        }

        const claim = await this.purchaseClaimRepository.upsert({
            merchantId: params.merchantId,
            customerId: params.customerId,
            orderId: params.orderId,
            purchaseToken: normalizedToken,
            claimingIdentityGroupId: finalGroupId,
            // On the unauthenticated arm the first claim wins: the claim row
            // is what the webhook later reads to attribute the purchase, so
            // letting a later caller overwrite it is the same hijack as
            // merging, one step earlier.
            rebindExisting: merge,
        });

        log.debug(
            {
                identityGroupId: claim.claimingIdentityGroupId,
                orderId: params.orderId,
            },
            "Created purchase claim, awaiting webhook validation"
        );

        return {
            success: true,
            identityGroupId: claim.claimingIdentityGroupId,
            pendingWebhook: true,
        };
    }

    private async reconcileWithExistingPurchase(
        purchase: PurchaseSelect,
        claimingGroupId: string,
        alreadyMerged: boolean,
        merchantId: string,
        merge: boolean
    ): Promise<ClaimPurchaseResult> {
        let finalIdentityGroupId = claimingGroupId;
        let merged = alreadyMerged;

        if (
            purchase.identityGroupId &&
            purchase.identityGroupId !== claimingGroupId
        ) {
            if (!merge) {
                // The purchase is already attributed to another group and
                // this caller is unauthenticated. Neither merging nor
                // repointing is safe — repointing would let a forged
                // `x-frak-client-id` steal an existing purchase. Keep the
                // stored attribution and record the interaction against it.
                log.warn(
                    {
                        purchaseId: purchase.id,
                        claimingGroupId,
                        purchaseGroupId: purchase.identityGroupId,
                    },
                    "Unauthenticated purchase claim for an already-attributed purchase; keeping the stored group"
                );
                finalIdentityGroupId = purchase.identityGroupId;
            } else {
                const { finalGroupId } =
                    await this.identityOrchestrator.associate(
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
        }

        // Persist the resolved identity group on the purchase row whenever it
        // differs from what's stored: either the webhook arrived first with
        // no claim (NULL group), or the merge above produced a new canonical
        // id. Swapped on the observed value, so a concurrent claim that
        // already attached its own group wins.
        if (purchase.identityGroupId !== finalIdentityGroupId) {
            const storedGroupId =
                await this.purchaseRepository.updateIdentityGroup(
                    purchase.id,
                    finalIdentityGroupId,
                    purchase.identityGroupId ?? null
                );
            if (storedGroupId && storedGroupId !== finalIdentityGroupId) {
                log.warn(
                    {
                        purchaseId: purchase.id,
                        claimingGroupId,
                        attemptedGroupId: finalIdentityGroupId,
                        storedGroupId,
                    },
                    "Concurrent purchase claim already attributed this purchase; keeping the stored group"
                );
                finalIdentityGroupId = storedGroupId;
            }
        }

        // Honour the persisted purchase status: a refund/cancel webhook may
        // have landed between the original webhook and this late claim, so
        // the interaction is recorded but born cancelled if already terminal.
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
            items,
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
