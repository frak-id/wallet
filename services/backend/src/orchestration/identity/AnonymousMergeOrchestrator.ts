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
     * Phase 4a enforcement (README §4.6, §7; DECISIONS §2.3) — the per-arm
     * latch check reused by both merge endpoints:
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
     * Returns whether a valid proof was presented. Latching is the caller's
     * job because the two arms can only write it at different points: the
     * initiate arm's node often does not exist yet (`resolveAndAssociate`
     * creates it), so a write here would silently hit zero rows.
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
         * Latch-gated, like the target arm: required once this id has ever
         * proven itself. The wallet arm (no `sourceAnonymousId`) is already
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

        // No mergeToken exists yet at initiate time, so the binding is
        // empty — mirrors frak-ensure-v1/frak-install-v1 (README §2.3).
        // Runs BEFORE resolveAndAssociate below: that call can merge an
        // authenticated caller's wallet group into whatever group this
        // sourceAnonymousId resolves to, so an unverified id must never
        // reach it.
        //
        // Latch-gated rather than unconditional. Requiring a proof outright
        // here would be correct in the steady state but is unshippable
        // today: the listener's `useOnGetMergeToken` still drops its RPC
        // param, so no caller in production sends one yet, and every
        // in-app-browser escape would 403 — the exact flow §7 Phase 4a's
        // acceptance requires to keep working end to end. The latch closes
        // the hole for every id that has a key the moment it first signs,
        // which is what makes enforcement per-identity and immediate rather
        // than a flag day (§4.6). Unproven ids stay claimable until then;
        // §7 accepts exactly that, and §2.6 is explicit that there is no fix
        // for legacy ids beyond shipping early.
        const proven = sourceAnonymousId
            ? await this.enforceProof({
                  anonymousId: sourceAnonymousId,
                  merchantId,
                  proof,
                  binding: new Uint8Array(0),
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

        if (sourceAnonymousId && proven) {
            // Latched only now: `enforceProof` ran before the node was
            // guaranteed to exist, since `resolveAndAssociate` creates it on
            // first-ever use — the common case for this arm. Writing the
            // latch there would silently match zero rows and leave the id
            // unprotected forever.
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
