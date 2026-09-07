import {
    db,
    type InstallCredentialCallSite,
    infraMetrics,
    log,
} from "@backend-infrastructure";
import { SERVER_MINTED_ID_PREFIX } from "@frak-labs/app-essentials/constants/serverMintedId";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import { CODE_TTL_HOURS } from "../../domain/identity/repositories/InstallCodeRepository";
import type { PurchaseClaimRepository } from "../../domain/purchases/repositories/PurchaseClaimRepository";
import type { PurchaseRepository } from "../../domain/purchases/repositories/PurchaseRepository";

/**
 * How long a pending `purchase_claims` row may still serve as a credential.
 *
 * At `generate` the claim only covers the pixel-before-webhook race, whose
 * normal latency is seconds; the webhook then deletes the row on reconcile, so
 * anything still pending an hour later is a failed webhook rather than a race —
 * and that row is forgeable, since the tracking route writes it unauthenticated.
 * At `resolve` the buyer has been to a store and back, so the bound is the
 * code's own TTL: a code that outlived it cannot be presented at all.
 */
const CLAIM_MAX_AGE_MS: Record<InstallCredentialCallSite, number> = {
    generate: 60 * 60 * 1000,
    resolve: CODE_TTL_HOURS * 60 * 60 * 1000,
};

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

        const claimAge = claim.createdAt
            ? Date.now() - claim.createdAt.getTime()
            : null;
        if (claimAge !== null && claimAge > CLAIM_MAX_AGE_MS[callSite]) {
            infraMetrics.installClaimAge("expired", callSite);
            log.warn(
                { merchantId, purchaseToken: checkoutToken, claimAge },
                "Refused a purchase claim past the age bound"
            );
            return null;
        }
        // A null `created_at` is unreachable for rows Postgres wrote: the
        // column defaults to now() and no writer overrides it. Accepted and
        // counted rather than refused, so a legitimate buyer never pays for a
        // typing artefact — the counter is what would prove otherwise.
        infraMetrics.installClaimAge(
            claimAge === null ? "undated" : "fresh",
            callSite
        );

        infraMetrics.installCredentialClaimArm(merchantId, callSite);
        log.warn(
            { merchantId, purchaseToken: checkoutToken, claimAge },
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
