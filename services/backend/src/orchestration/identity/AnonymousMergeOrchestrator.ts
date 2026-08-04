import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { Address } from "viem";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { AnonymousMergeService } from "../../domain/identity/services/AnonymousMergeService";
import type { IdentityProofService } from "../../domain/identity/services/IdentityProofService";
import type { IdentityOrchestrator } from "./IdentityOrchestrator";
import { enforceLatchedProof } from "./latchedProof";
import type { IdentityNode } from "./types";

export class AnonymousMergeOrchestrator {
    constructor(
        private readonly anonymousMergeService: AnonymousMergeService,
        private readonly identityRepository: IdentityRepository,
        private readonly identityOrchestrator: IdentityOrchestrator,
        private readonly identityProofService: IdentityProofService
    ) {}

    /**
     * Latch enforcement, shared by `initiateMerge`'s `sourceAnonymousId` arm
     * and `executeMerge`'s `targetAnonymousId` arm.
     *
     * Either side may be a legacy id (no key, can never produce a proof) and
     * must keep working: an unlatched id is allowed as an unproven source or
     * target so the pre-derivation population isn't cut off. The latch
     * closes the hole for every id that *does* have a key:
     *
     *   1. proof present → verify; invalid ⇒ 403 PROOF_INVALID, valid ⇒ allow.
     *   2. proof absent  → read the node's latch; latched ⇒ 403
     *      PROOF_REQUIRED, otherwise allow.
     *
     * The latch read happens only on the proof-absent path — the proven path
     * costs zero extra query.
     *
     * Returns whether a valid proof was presented, so the caller can decide
     * whether to (re-)write the latch.
     */
    private async enforceProof(params: {
        anonymousId: string;
        merchantId: string;
        proof?: string;
        binding: Uint8Array;
        context?: string;
    }): Promise<boolean> {
        const { anonymousId, merchantId, proof, binding, context } = params;
        return enforceLatchedProof({
            op: "frak-merge-v1",
            anonymousId,
            merchantId,
            proof,
            binding,
            context: context ?? "merge execute (Phase 4a: enforced)",
            identityProofService: this.identityProofService,
            identityRepository: this.identityRepository,
        });
    }

    /**
     * Initiate an identity merge by generating a JWT token bound to a source
     * identity group and merchant.
     *
     * Supports two source shapes:
     *  1. Anonymous fingerprint (existing flow) — partner site SDK hands off
     *     its `clientId` across browser contexts (e.g. in-app → external).
     *  2. Authenticated wallet (explorer flow) — wallet app mints a token
     *     representing the wallet identity so the merchant SDK can link the
     *     wallet into its per-merchant anonymous group on arrival.
     *
     * IMPORTANT: Auto-creates the source identity group when only an
     * anonymous fingerprint is provided. This is necessary because the SDK
     * generates `clientId` on first page load, but the identity group is
     * only created when the user performs an action (tracking, auth, etc.).
     * Pattern matches: /track/arrival, /wallet/auth/register, /wallet/auth/login.
     */
    async initiateMerge(params: {
        merchantId: string;
        sourceAnonymousId?: string;
        sourceWalletAddress?: Address;
        /**
         * `frak-merge-v1` proof binding `sourceAnonymousId`. Latch-gated
         * whenever `sourceAnonymousId` is supplied: verified when present,
         * required only once this id has ever latched. A legacy id — or a
         * derived id that has simply never signed yet — keeps working
         * without one. The wallet arm (no `sourceAnonymousId`) is already
         * authenticated by session and never gated at all.
         */
        proof?: string;
    }): Promise<{ mergeToken: string; expiresAt: Date }> {
        const { sourceAnonymousId, sourceWalletAddress, merchantId, proof } =
            params;

        if (!sourceAnonymousId && !sourceWalletAddress) {
            throw HttpError.badRequest(
                "MISSING_SOURCE_IDENTITY",
                "sourceAnonymousId or sourceWalletAddress is required"
            );
        }

        // Runs BEFORE resolveAndAssociate below: that call can merge an
        // authenticated caller's wallet group into whatever group this
        // sourceAnonymousId resolves to, so an unverified id must never
        // reach it.
        //
        // Latch-gated, not unconditionally mandatory: a legacy id (no key,
        // can never sign) must still be usable as a merge source until it
        // has proven itself once. Same policy as `executeMerge`: proof
        // present → verify (invalid ⇒ 403 PROOF_INVALID); proof absent → 403
        // only if this id has ever latched, else allow. The wallet-session
        // arm (no `sourceAnonymousId`) is untouched — authenticated by
        // session, never by this check.
        //
        // ROLLOUT-STEP-3: revisit whether this arm should become
        // unconditionally mandatory once the wallet binary and legacy SDK
        // population have aged out (see ROLLOUT.md).
        //
        // TODO(merge-initiate-proof): one production caller still sends no
        // proof here — the listener's modal / embedded-wallet path, via
        // `mergeTokenQueryOptions`. Those ids can therefore never latch. That
        // caller must send a proof before this arm is made mandatory, or the
        // in-app-browser escape 403s outright. The SDK's RPC path
        // (`useOnGetMergeToken`) already sends one.
        const sourceProofPresented = sourceAnonymousId
            ? await this.enforceProof({
                  anonymousId: sourceAnonymousId,
                  merchantId,
                  proof,
                  binding: new Uint8Array(0),
                  context: "merge initiate (latch-gated)",
              })
            : false;

        // Build source identity nodes. Wallet nodes are merchant-agnostic;
        // anonymous fingerprints are scoped to the merchant.
        const identityNodes: IdentityNode[] = [];
        if (sourceWalletAddress) {
            identityNodes.push({ type: "wallet", value: sourceWalletAddress });
        }
        if (sourceAnonymousId) {
            identityNodes.push({
                type: "anonymous_fingerprint",
                value: sourceAnonymousId,
                merchantId,
            });
        }

        // resolveAndAssociate is idempotent and also merges the wallet ↔
        // anon-fingerprint groups when both are provided (e.g. wallet app
        // has both values in its context).
        const { finalGroupId: sourceGroupId } =
            await this.identityOrchestrator.resolveAndAssociate(identityNodes);

        if (sourceAnonymousId && sourceProofPresented) {
            // Written only now: the node isn't guaranteed to exist before
            // `resolveAndAssociate` above creates it. Gated on
            // `sourceProofPresented`, not unconditional — latching an id
            // that never proved possession would permanently lock it out
            // of ever being a merge source again.
            await this.identityRepository.markProofSeen({
                type: "anonymous_fingerprint",
                value: sourceAnonymousId,
                merchantId,
            });
        }

        return this.anonymousMergeService.generateToken({
            sourceAnonymousId,
            sourceWalletAddress,
            merchantId,
            sourceGroupId,
        });
    }

    /**
     * Execute the merge using a valid token.
     *
     * Delegates the actual merge to IdentityOrchestrator.associate() which
     * handles idempotency, wallet conflict detection, weight-based anchor
     * determination, merge execution, and cache invalidation.
     */
    async executeMerge(params: {
        mergeToken: string;
        targetAnonymousId: string;
        merchantId: string;
        /**
         * `frak-merge-v1` proof binding `targetAnonymousId` AND
         * `SHA-256(mergeToken)`. The token binding removes the need for a
         * replay cache — a stolen proof is useless without the exact,
         * 60-min-lived token it was signed alongside. Required only once
         * this id has ever latched — unlatched ids, including legacy ones,
         * keep working as merge targets.
         */
        proof?: string;
    }): Promise<{ finalGroupId: string; merged: boolean }> {
        const { mergeToken, targetAnonymousId, merchantId, proof } = params;

        if (
            await this.enforceProof({
                anonymousId: targetAnonymousId,
                merchantId,
                proof,
                binding: this.identityProofService.hashMergeToken(mergeToken),
            })
        ) {
            // The target node already exists here — `findGroupByIdentity`
            // below hard-fails with TARGET_NOT_FOUND otherwise — so unlike
            // the initiate arm the latch can be written straight away.
            await this.identityRepository.markProofSeen({
                type: "anonymous_fingerprint",
                value: targetAnonymousId,
                merchantId,
            });
        }

        const { sourceGroupId } =
            await this.anonymousMergeService.validateToken({
                mergeToken,
                merchantId,
            });
        const targetGroup = await this.identityRepository.findGroupByIdentity({
            type: "anonymous_fingerprint",
            value: targetAnonymousId,
            merchantId,
        });

        if (!targetGroup) {
            throw HttpError.notFound(
                "TARGET_NOT_FOUND",
                "Target anonymous identity not found"
            );
        }
        // Delegate to IdentityOrchestrator.associate() which handles
        // idempotency, wallet conflict detection (throws HttpError), weight-
        // based anchor determination, merge execution, and cache invalidation.
        const { finalGroupId, merged } =
            await this.identityOrchestrator.associate(
                sourceGroupId,
                targetGroup.id
            );

        if (merged) {
            log.info(
                {
                    sourceGroupId,
                    targetGroupId: targetGroup.id,
                    finalGroupId,
                },
                "Anonymous identity groups merged successfully"
            );
        }

        return {
            finalGroupId,
            merged,
        };
    }
}
