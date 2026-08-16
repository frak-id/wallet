import {
    db,
    type InstallCredentialCallSite,
    infraMetrics,
    log,
} from "@backend-infrastructure";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import { SERVER_MINTED_ID_PREFIX } from "../../domain/identity/schemas/serverMintedId";
import type { PurchaseClaimRepository } from "../../domain/purchases/repositories/PurchaseClaimRepository";
import type { PurchaseRepository } from "../../domain/purchases/repositories/PurchaseRepository";

/**
 * Outcome of resolving a Shopify checkout token: an id, a `deferred` retry at
 * redeem time, or `unresolved` when the merchant has no webhook at all.
 */
export type InstallCredentialResolution =
    | { outcome: "resolved"; anonymousId: string }
    | { outcome: "deferred" }
    | { outcome: "unresolved" };

/**
 * The Gate 2 degradation ladder: a checkout token resolved to an anonymous id
 * across the identity and purchases domains. Ordering is load-bearing — a
 * webhook-resolved purchase always beats a `purchase_claims` row, because the
 * claim row is written by the unauthenticated tracking route and is therefore
 * forgeable.
 */
export class InstallCredentialOrchestrator {
    constructor(
        private readonly identityRepository: IdentityRepository,
        private readonly purchaseRepository: PurchaseRepository,
        private readonly purchaseClaimRepository: PurchaseClaimRepository
    ) {}

    async resolveForGenerate(params: {
        merchantId: string;
        checkoutToken: string;
    }): Promise<InstallCredentialResolution> {
        return this.resolve(params, true, "generate");
    }

    /**
     * The read-only half of the ladder, for the unauthenticated resolve path:
     * it must never materialise a node, since nothing there proves the caller
     * owns the order.
     */
    async resolveDeferred(params: {
        merchantId: string;
        checkoutToken: string;
    }): Promise<{ anonymousId: string } | null> {
        const resolution = await this.resolve(params, false, "resolve");
        return resolution.outcome === "resolved"
            ? { anonymousId: resolution.anonymousId }
            : null;
    }

    private async resolve(
        params: { merchantId: string; checkoutToken: string },
        materialise: boolean,
        callSite: InstallCredentialCallSite
    ): Promise<InstallCredentialResolution> {
        const resolution = await this.runLadder(params, materialise, callSite);
        infraMetrics.installCredentialOutcome(resolution.outcome, callSite);
        return resolution;
    }

    private async runLadder(
        params: { merchantId: string; checkoutToken: string },
        materialise: boolean,
        callSite: InstallCredentialCallSite
    ): Promise<InstallCredentialResolution> {
        const { merchantId, checkoutToken } = params;

        const webhook =
            await this.purchaseRepository.getWebhookByMerchantId(merchantId);
        if (!webhook) {
            return { outcome: "unresolved" };
        }

        const groupId = await this.resolveGroupId({
            merchantId,
            checkoutToken,
            webhookId: webhook.id,
            callSite,
        });
        if (!groupId) {
            return { outcome: "deferred" };
        }

        const existing = await this.identityRepository.findAnonymousFingerprint(
            { groupId, merchantId }
        );
        if (existing) {
            return { outcome: "resolved", anonymousId: existing };
        }
        if (!materialise) {
            return { outcome: "deferred" };
        }

        return {
            outcome: "resolved",
            anonymousId: await this.materialiseAnonymousId({
                groupId,
                merchantId,
            }),
        };
    }

    /** Ladder steps 1 and 2: resolved purchase first, forgeable claim second. */
    private async resolveGroupId(params: {
        merchantId: string;
        checkoutToken: string;
        webhookId: number;
        callSite: InstallCredentialCallSite;
    }): Promise<string | null> {
        const { merchantId, checkoutToken, webhookId, callSite } = params;

        const purchase =
            await this.purchaseRepository.findByMerchantAndCheckoutToken({
                webhookId,
                checkoutToken,
            });
        if (purchase?.identityGroupId) {
            return purchase.identityGroupId;
        }

        const claim = await this.purchaseClaimRepository.findByMerchantAndToken(
            { merchantId, purchaseToken: checkoutToken }
        );
        if (!claim) {
            return null;
        }

        infraMetrics.installCredentialClaimArm(merchantId, callSite);
        log.warn(
            {
                merchantId,
                purchaseToken: checkoutToken,
                claimAge: claim.createdAt
                    ? Date.now() - claim.createdAt.getTime()
                    : null,
            },
            "Install credential resolved from an unvalidated purchase claim"
        );
        return claim.claimingIdentityGroupId;
    }

    /**
     * Two concurrent generates for the same group can both see no node; the
     * re-read inside the transaction narrows that window. A loser's orphan is
     * harmless — latched, keyless, and never selected once the oldest node wins.
     */
    private async materialiseAnonymousId(params: {
        groupId: string;
        merchantId: string;
    }): Promise<string> {
        const { groupId, merchantId } = params;

        return db.transaction(async (tx) => {
            const existing =
                await this.identityRepository.findAnonymousFingerprint(
                    { groupId, merchantId },
                    tx
                );
            if (existing) {
                return existing;
            }

            const value = `${SERVER_MINTED_ID_PREFIX}${crypto.randomUUID()}`;
            await this.identityRepository.addNode(
                {
                    groupId,
                    type: "anonymous_fingerprint",
                    value,
                    merchantId,
                },
                tx
            );
            await this.identityRepository.latchServerMintedProof(
                { value, merchantId },
                tx
            );

            log.info(
                {
                    merchantId,
                    anonymousId: value,
                    source: "shopify-checkout-token",
                },
                "Materialised a server-minted anonymous id"
            );
            return value;
        });
    }
}
