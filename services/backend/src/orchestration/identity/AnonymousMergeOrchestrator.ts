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
     * Latch enforcement (README §4.6, §7; DECISIONS §2.3;
     * DUAL-ARM-PLAN.md D-A) — shared by BOTH `initiateMerge`'s
     * `sourceAnonymousId` arm and `executeMerge`'s `targetAnonymousId` arm.
     *
     * Either side may be a LEGACY id (minted before derivation shipped, no
     * key, can never produce a proof) and must keep working (README §2.6).
     * README §7 Phase 4a's "a legacy id may be a merge target but never a
     * merge source" is DEFERRED past Phase 5 by the revised dual-arm
     * decision: an unlatched id is allowed as an unproven source too, so
     * that the pre-derivation population is not cut off. The latch is what
     * still closes the hole for every id that *does* have a key:
     *
     *   1. proof present  → verify; invalid ⇒ 403 PROOF_INVALID, valid ⇒
     *      allow.
     *   2. proof absent   → read the node's latch; latched ⇒ 403
     *      PROOF_REQUIRED, otherwise allow (legacy id, or a derived id that
     *      has simply never proven itself yet).
     *
     * The latch read happens ONLY on the proof-absent path — the proven
     * path (the future steady state) costs zero extra query, verification
     * being pure CPU.
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
         * `frak-merge-v1` proof binding `sourceAnonymousId` (README §4.2).
         * Latch-gated whenever `sourceAnonymousId` is supplied
         * (DUAL-ARM-PLAN.md WS-BE-1): verified when present, required only
         * once this id has ever latched (README §4.6). A legacy id — or a
         * derived id that has simply never signed yet — keeps working
         * without one. The wallet arm (no `sourceAnonymousId`) is already
         * authenticated by session and is never gated at all (README §4.2,
         * "per-arm, not per-endpoint").
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
        // Latch-gated (DUAL-ARM-PLAN.md WS-BE-1), NOT unconditionally
        // mandatory as ROLLOUT-STEP-2 previously had it: a legacy id (no
        // key, can never sign — the entire pre-derivation population, per
        // DECISIONS §3.1 D6) must still be usable as a merge source until it
        // has proven itself once. `enforceProof` is the exact same policy
        // `executeMerge` already uses: proof present → verify (invalid ⇒
        // 403 PROOF_INVALID); proof absent → 403 only if this id has ever
        // latched, else allow (fail-open, matching pre-proof behaviour). The
        // wallet-session arm (no `sourceAnonymousId`) is untouched — it is
        // authenticated by session, never by this check.
        //
        // ROLLOUT-STEP-3: revisit whether this arm should become
        // unconditionally mandatory once the wallet binary and legacy SDK
        // population have aged out (see ROLLOUT.md).
        //
        // TODO(merge-initiate-proof): one production caller still sends NO
        // proof here — the listener's modal / embedded-wallet path, via
        // `mergeTokenQueryOptions` (see the TODO there for why it is
        // deferred and the two constraints on fixing it). Those ids can
        // therefore never latch. That caller must send a proof BEFORE this
        // arm is made mandatory, or the in-app-browser escape 403s outright.
        // The SDK's RPC path (`useOnGetMergeToken`) already sends one.
        const sourceProofPresented = sourceAnonymousId
            ? await this.enforceProof({
                  anonymousId: sourceAnonymousId,
                  merchantId,
                  proof,
                  binding: new Uint8Array(0),
                  context: "merge initiate (WS-BE-1: latch-gated)",
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
            // Written only now: the node is not guaranteed to exist before
            // `resolveAndAssociate` above, which creates it on first-ever
            // use — the common case for this arm. Gated on
            // `sourceProofPresented`, NOT unconditional: `enforceProof` above
            // can return `false` on the fail-open path (no proof, id never
            // latched — e.g. a legacy id). Latching an id that never proved
            // possession would be a one-way corruption, permanently locking
            // that id out of ever being a merge source again.
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
         * `SHA-256(mergeToken)` (README §2.2, §4.3). The token binding is
         * what removes the need for a replay cache on this path — a stolen
         * proof is useless without the exact, 60-min-lived token it was
         * signed alongside. Required only once this id has ever proven
         * itself (§4.6 latch) — unlatched ids, including legacy ones, keep
         * working as merge targets (§7 Phase 4a).
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

        // 1. Validate the token
        const { sourceGroupId } =
            await this.anonymousMergeService.validateToken({
                mergeToken,
                merchantId,
            });
        // 2. Resolve target group
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
