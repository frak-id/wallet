import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { Address } from "viem";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { AnonymousMergeService } from "../../domain/identity/services/AnonymousMergeService";
import type { IdentityProofService } from "../../domain/identity/services/IdentityProofService";
import type { IdentityOrchestrator } from "./IdentityOrchestrator";
import type { IdentityNode } from "./types";

export class AnonymousMergeOrchestrator {
    constructor(
        private readonly anonymousMergeService: AnonymousMergeService,
        private readonly identityRepository: IdentityRepository,
        private readonly identityOrchestrator: IdentityOrchestrator,
        private readonly identityProofService: IdentityProofService
    ) {}

    /**
     * Phase 4a latch enforcement (README §4.6, §7; DECISIONS §2.3) — used
     * ONLY by `executeMerge`'s `targetAnonymousId` arm. A target may be a
     * LEGACY id (minted before derivation shipped, no key, can never
     * produce a proof) and must keep working forever (README §2.6, §7
     * Phase 4a: "a legacy id may be a merge target but never a merge
     * source"). The latch is what still closes the hole for every id that
     * *does* have a key:
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
    }): Promise<boolean> {
        const { anonymousId, merchantId, proof, binding } = params;

        if (proof) {
            const result = await this.identityProofService.verify({
                op: "frak-merge-v1",
                proof,
                merchantId,
                anonymousId,
                binding,
            });
            if (!result.valid) {
                log.info(
                    { merchantId, anonymousId, reason: result.reason },
                    "Identity proof rejected on merge (Phase 4a: enforced)"
                );
                throw HttpError.forbidden(
                    "PROOF_INVALID",
                    "Identity proof failed verification"
                );
            }
            return true;
        }

        const node = await this.identityRepository.findNodeByIdentity({
            type: "anonymous_fingerprint",
            value: anonymousId,
            merchantId,
        });
        if (node?.proofSeenAt) {
            throw HttpError.forbidden(
                "PROOF_REQUIRED",
                "This identity has previously proven possession of its key and now requires a proof on every merge"
            );
        }
        // Unlatched — legacy id, or a derived id that has never proven
        // itself yet. Fail-open, matching today's pre-proof behaviour.
        return false;
    }

    /**
     * Mandatory proof check used ONLY by `initiateMerge`'s
     * `sourceAnonymousId` arm (ROLLOUT-STEP-2 — listener-only, never reaches
     * the Tauri binary; see ROLLOUT.md). Unlike `enforceProof` there is no
     * latch fallback: no proof, or an invalid one, is always a 403. This is
     * the arm that mints merge tokens for arbitrary ids, so it is the
     * highest-value place to require possession outright rather than
     * per-identity latch it.
     */
    private async requireProof(params: {
        anonymousId: string;
        merchantId: string;
        proof?: string;
    }): Promise<void> {
        const { anonymousId, merchantId, proof } = params;

        if (!proof) {
            throw HttpError.forbidden(
                "PROOF_REQUIRED",
                "A frak-merge-v1 proof is required for sourceAnonymousId"
            );
        }

        const result = await this.identityProofService.verify({
            op: "frak-merge-v1",
            proof,
            merchantId,
            anonymousId,
            binding: new Uint8Array(0),
        });
        if (!result.valid) {
            log.info(
                { merchantId, anonymousId, reason: result.reason },
                "Identity proof rejected on merge initiate (Phase 4a: mandatory)"
            );
            throw HttpError.forbidden(
                "PROOF_INVALID",
                "Identity proof failed verification"
            );
        }
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
         * Mandatory whenever `sourceAnonymousId` is supplied (ROLLOUT-STEP-2
         * — listener-only arm, never reaches the Tauri binary). The wallet
         * arm (no `sourceAnonymousId`) is already authenticated by session
         * and is never gated at all (README §4.2, "per-arm, not
         * per-endpoint").
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
        // Mandatory, not latch-gated (ROLLOUT-STEP-2, ROLLOUT.md): the
        // listener now forwards its `frak-merge-v1` proof on this arm, so
        // every in-app-browser escape presents one and there is no fail-open
        // path left to preserve here. The wallet-session arm (no
        // `sourceAnonymousId`) is untouched — it is authenticated by session,
        // never by this check.
        if (sourceAnonymousId) {
            await this.requireProof({
                anonymousId: sourceAnonymousId,
                merchantId,
                proof,
            });
        }

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

        if (sourceAnonymousId) {
            // Written only now: the node is not guaranteed to exist before
            // `resolveAndAssociate` above, which creates it on first-ever
            // use — the common case for this arm. A proof is guaranteed valid
            // here (mandatory check above already threw otherwise), so this
            // is unconditional rather than gated on a returned "proven" flag.
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
